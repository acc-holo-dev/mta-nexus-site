# MTA NEXUS — техническая архитектура

> Статус: рабочая спецификация handbook v0.1, 2026-10-06.  
> Источник фактического состояния: `acc-holo-dev/mta-nexus-site` (`main`), прежде всего код, миграции, тесты и `docs/ARCHITECTURE.md`.

## 1. Зачем нужен этот документ

Этот файл объясняет архитектуру MTA NEXUS на уровне, достаточном для:

- нового разработчика;
- AI-агента, продолжающего проект;
- технического аудита;
- принятия решений о масштабировании;
- понимания границ между текущим продуктом и будущими идеями.

Он не заменяет исходный код. Если этот файл и актуальный `main` расходятся, истиной является код и миграции, после чего документация должна быть исправлена.

---

## 2. Архитектурная форма

### CURRENT

MTA NEXUS — **модульный монолит**.

Текущая форма сознательно проще распределённой системы:

- одно веб-приложение;
- одна основная PostgreSQL;
- единая модель авторизации;
- общие доменные библиотеки;
- приватное файловое хранилище через абстракцию storage;
- ClamAV как отдельная инфраструктурная зависимость для проверки артефактов;
- Docker Compose как основной воспроизводимый runtime для разработки и текущей production-модели.

### DECISION

Не вводить Redis, отдельные очереди, Kafka, микросервисы, Kubernetes или многоинстансную координацию только «на будущее».

Такие компоненты появляются лишь тогда, когда есть измеренная причина: нагрузка, latency, отказоустойчивость, фоновые задачи, объём данных или эксплуатационная необходимость.

---

## 3. Основной стек

### Web

- Next.js 16;
- React 19;
- App Router;
- TypeScript;
- server-side rendering там, где это даёт правильный security/cache boundary;
- клиентские компоненты — только для интерактивности.

### Runtime/toolchain

- Node.js >= 26;
- pnpm >= 12.4.2;
- Biome;
- Vitest;
- browser acceptance на Chromium/Playwright-сценариях;
- Docker / Docker Compose.

### Data

- PostgreSQL 18;
- Drizzle ORM;
- append-only forward migrations после попадания миграции в общую среду.

### Artifact security

- приватное storage;
- ClamAV INSTREAM;
- SHA-256;
- сохранённые метаданные размера и хеша;
- fail-closed публикация.

---

## 4. Карта монорепозитория

```text
mta-nexus-site/
├─ apps/
│  └─ web/                 Next.js application, routes, API, UI
├─ packages/
│  ├─ db/                  schema, migrations, repositories, seed
│  ├─ domain/              domain types/events/shared invariants
│  ├─ security/            authorization, identifiers, rate limiting
│  ├─ storage/             private asset storage abstraction
│  ├─ ui/                  shared visual primitives
│  ├─ config/              environment/runtime validation
│  └─ validation/          request/input schemas
├─ scripts/                doctor, release evidence, operational tooling
├─ tests/                  unit, database, integration/contract acceptance
├─ docs/                   durable repository documentation
├─ compose.yaml            supported local development stack
├─ compose.production.yaml production topology
└─ Dockerfile              application image
```

### Архитектурный принцип

Функциональность должна попадать в правильный слой:

- UI не определяет права;
- route не дублирует доменную политику, если она уже централизована;
- repository не должен становиться UI/business-controller;
- validation отсекает недопустимую форму данных до мутаций;
- security принимает решение по текущему actor/context, а не историческому авторству;
- database constraints удерживают критические инварианты даже при ошибке прикладного кода.

---

## 5. Runtime-контуры

### 5.1 Public web

Публичный контур обслуживает:

- главную страницу;
- каталог ресурсов;
- страницы ресурсов;
- каталог MTA-серверов;
- страницы серверов;
- публичные профили пользователей/разработчиков/организаций;
- опубликованный content.

Публичная страница не должна случайно раскрывать:

- email;
- session/security metadata;
- закрытые storage keys;
- приватные membership details;
- приватные серверные данные;
- необработанные fraud/moderation данные;
- license keys.

### 5.2 Authenticated workspace

Приватный workspace предназначен для действий владельца:

- управление ресурсами и их версиями;
- создание ресурса;
- управление собственными серверами;
- лицензии/entitlements, если они применимы;
- настройки аккаунта;
- уведомления.

### 5.3 Moderation/admin

Admin surface работает поверх тех же доменных данных, но имеет отдельные authority checks.

Модераторская роль не должна автоматически превращаться в неограниченный root-доступ. Каждое действие должно иметь конкретное разрешение, target и audit semantics.

---

## 6. Поток публикации ресурса

Упрощённо:

```text
Author
  -> create product draft
  -> upload bounded archive
  -> validate multipart/body/metadata
  -> private temporary storage
  -> ClamAV scan
  -> SHA-256 / size metadata
  -> immutable storage key publication
  -> Build: pending_review
  -> Moderator review
  -> publish/reject
  -> product version synchronization
  -> author notification
  -> public catalog visibility only after safe-build predicate
```

### Ключевой инвариант

Публично используемый build существует только если одновременно выполняется:

```text
status = published
scanStatus = clean
scanner != empty
scannedAt != null
```

Это не UI-фильтр. Политика должна соблюдаться в read/query paths, moderation transitions, claim и download.

---

## 7. Поток бесплатного получения и скачивания

```text
Authenticated user
  -> claim free published product
  -> transaction locks claim identity
  -> verify safe downloadable build
  -> reuse active entitlement on retry OR create one
  -> return server-authoritative result
  -> download route re-authorizes
  -> verify recorded artifact metadata
  -> compute SHA-256 on opened file
  -> audit *_download_started
  -> bounded stream with backpressure/cancellation
```

### Почему повторная проверка перед download обязательна

Даже если build когда-то прошёл moderation:

- storage мог быть повреждён;
- файл мог исчезнуть;
- metadata могла разойтись;
- entitlement мог истечь/быть отозван;
- состояние продукта могло измениться.

Поэтому скачивание не доверяет только прошлому решению.

---

## 8. Storage-модель

### CURRENT

Local private storage является текущей реализацией storage abstraction.

Свойства:

- ключ генерируется системой, а не пользовательским filename;
- ключи immutable;
- новый upload не перезаписывает существующий ключ;
- запись идёт через временный файл;
- завершённый файл публикуется атомарно через hard-link semantics;
- download получает metadata и stream из одного открытого file handle;
- перед передачей проверяются size/hash;
- отмена запроса освобождает чтение и stream best-effort.

### OPEN

Будущий S3-compatible/object-storage provider допустим, если сохраняет те же продуктовые гарантии:

- private by default;
- immutable object identity;
- integrity metadata;
- bounded access;
- server-side authorization;
- понятная failure semantics.

Нельзя менять security semantics только потому, что новый storage provider делает публичные URL удобнее.

---

## 9. MTA server discovery

### CURRENT

MTA NEXUS читает официальный/публичный MTA master directory как внешний источник live-состояния.

Защитные границы:

- максимум 8 MiB ответа;
- максимум 10 000 серверов;
- oversized response отменяется;
- последний успешный snapshot при временном сбое может использоваться максимум 15 минут;
- stale-состояние маркируется;
- outage retry не продлевает бесконечно доверие к старым данным.

### Принцип

**Editorial server data** и **live observation** — разные слои.

Владелец может описать сервер, загрузить брендинг и управлять профилем, но не должен вручную подделывать текущий онлайн.

---

## 10. Владение сервером

Текущий NEXUS разделяет:

1. обнаружение сервера в публичном directory;
2. запрос контроля;
3. challenge/proof;
4. verification request;
5. решение платформы о владении/доверии.

### DECISION

Proof контроля над server endpoint и moderator approval — разные факты.

Нельзя свести их к одной кнопке «верифицирован».

---

## 11. Authentication и sessions

### CURRENT

Существуют:

- регистрация;
- login;
- server-side session;
- список сессий;
- отзыв сессий;
- смена пароля;
- email verification;
- password recovery;
- активный user/organization context.

### Security principle

Любая чувствительная мутация должна проверять текущего actor и текущие права в момент выполнения.

Исторический `authorId` не должен давать вечный доступ после смены ownership/context.

---

## 12. Context и организации

Пользователь может действовать:

- лично;
- от имени организации, если является её участником и имеет необходимые права.

Смена context:

- блокирует relevant rows;
- заново проверяет membership;
- меняет activeContextId;
- пишет audit;
- откатывается полностью при ошибке audit.

Это предотвращает «частично успешный» switch.

---

## 13. Notifications

Уведомления — общий platform primitive, а не часть одного feature.

Категории preferences уже включают:

- follows;
- content;
- server;
- commerce;
- system.

### Принцип

Notification должна быть actionable: вести пользователя к ресурсу, решению или событию, а не создавать шум ради engagement.

Build review notifications создаются транзакционно с moderation decision. Нельзя показывать «одобрено», если сам переход не зафиксирован.

---

## 14. Content engine

Content — общий тип для платформенных/пользовательских публикаций.

Текущий слой допускает связь материала с:

- автором;
- server;
- product;
- organization.

Это позволяет строить статьи, updates, announcements и другие editorial surfaces без отдельной CMS на каждую сущность.

### Ограничение

Связь в базе не означает автоматически публичную связь. Публичная выдача обязана соблюдать ownership/privacy/publishing policy.

---

## 15. Moderation architecture

Текущие очереди включают:

- resource build review;
- content moderation;
- reports;
- verification requests.

Ключевые свойства:

- bounded pagination;
- oldest pending first;
- separate history;
- dedicated counts;
- stale concurrent decision -> conflict, а не last-write-wins;
- review context/reason;
- audit trail;
- notifications where applicable.

---

## 16. Audit

Audit фиксирует значимые системные действия.

### Important semantic rule

Событие должно описывать то, что система действительно знает.

Например, перед началом бинарной передачи корректно писать:

```text
resource_download_started
```

а не:

```text
resource_download_completed
```

потому что HTTP stream может оборваться после создания response.

---

## 17. URL и external-link policy

Для публичных HTTP(S)-ссылок используется единая validation policy.

Она запрещает, среди прочего:

- credentials в URL;
- control characters;
- whitespace;
- backslash;
- непредусмотренные schemes;
- oversized values.

### Не путать

Это защита browser-link surface, **не SSRF-защита** и не доказательство доверия к удалённому хосту.

---

## 18. Кэширование и приватность

Приватные authenticated responses не должны становиться публично кэшируемыми.

При проектировании любого endpoint необходимо определить:

- public/private;
- cacheable/non-cacheable;
- actor-dependent/actor-independent;
- stale допустим или нет;
- источник истины.

Особенно это важно для:

- notifications;
- workspace;
- moderation;
- ownership;
- entitlements/licenses;
- sessions.

---

## 19. Server-authoritative UI

Client state не является окончательной истиной для:

- follow;
- claim;
- notification read-state;
- ownership;
- moderation;
- resource publishing;
- session changes.

Клиент показывает success только после подтверждённого server response для ожидаемого target и состояния.

---

## 20. Data consistency

### Базовые правила

- критические multi-write операции — транзакционные;
- concurrency-sensitive действия используют lock/uniqueness/advisory mechanisms;
- database constraints дублируют критическую safety policy;
- retries не создают дубликаты;
- no-op retry не создаёт лишний audit noise;
- read-side pagination имеет стабильный secondary sort по id.

---

## 21. Migrations

### CURRENT POLICY

- schema change => новая forward migration;
- общая migration после применения не переписывается;
- code rollback не означает database rollback;
- перед data-changing migration проверяется target inventory;
- production migration выполняется только при backup/restore readiness.

### PostgreSQL major upgrade

Нельзя подключать data directory от другой major-версии PostgreSQL как «обновление».

Использовать:

- `pg_dump`/`pg_restore`; или
- поддерживаемый `pg_upgrade`.

---

## 22. Development topology

Поддерживаемый локальный stack:

```text
Browser
   |
localhost:<NEXUS_DEV_PORT>
   |
Next.js app
   |---- PostgreSQL
   |---- ClamAV
   `---- private local uploads
```

PostgreSQL и ClamAV не публикуются наружу host network в стандартном Compose.

### `/dev`

В development доступна санитаризированная runtime status surface. В production она должна отсутствовать.

---

## 23. Production topology

Текущая production-модель рассчитана на небольшой controlled deployment:

- reverse proxy/TLS;
- application container;
- PostgreSQL;
- private uploads volume;
- ClamAV;
- optional mail worker в настроенной конфигурации.

Это не обещание HA и не multi-region architecture.

---

## 24. Масштабирование: только по сигналу

Потенциальные будущие шаги, если появятся реальные метрики:

### Stage A — улучшение монолита

- query/index optimization;
- CDN для безопасных public media;
- object storage;
- dedicated background worker;
- better observability;
- read caching там, где stale безопасен.

### Stage B — горизонтальное приложение

Только после решения:

- session coordination;
- distributed rate limits;
- job ownership;
- shared storage;
- cache invalidation;
- migration/deploy orchestration.

### Stage C — выделение сервисов

Сервис выделяется по измеряемой operational/domain причине, а не по эстетике архитектуры.

---

## 25. Что нельзя случайно вернуть из MTA-MARKET-PLATFORM

Legacy-код/документация содержали:

- Redis;
- отдельный backend;
- расширенный payment layer;
- DRM module;
- ledger;
- много дополнительных production services.

### DECISION

Эти элементы нельзя автоматически переносить в NEXUS как «улучшение».

Сначала требуется отдельная product/architecture decision с ответом:

1. какую текущую проблему решаем;
2. почему текущий монолит не справляется;
3. какой operational cost добавляется;
4. какие security/legal последствия;
5. как будет тестироваться и откатываться изменение.

---

## 26. Архитектурные invariants для AI-агента

AI-агент должен сохранять:

1. `main` как текущую линию разработки;
2. RU/EN как равноправные интерфейсы;
3. free-only closed-beta commerce boundary до решения владельца;
4. fail-closed resource safety;
5. current-actor authorization;
6. server-authoritative mutation results;
7. privacy by default;
8. exact audit semantics;
9. forward migrations;
10. no distributed complexity without evidence;
11. production release только по проверенному exact SHA;
12. backup/restore перед risk-bearing production change.

---

## 27. Открытые архитектурные решения

### OPEN A-01 — production hosting

Не зафиксирована окончательная целевая площадка/провайдер production.

### OPEN A-02 — object storage

Нужен ли S3-compatible storage до публичного релиза или local/private volume достаточно на первый этап?

### OPEN A-03 — background jobs

Какие задачи должны стать настоящими очередями/worker jobs, а какие могут оставаться синхронными или cron-like?

### OPEN A-04 — observability

Нужно определить production baseline:

- logs;
- metrics;
- error tracking;
- uptime;
- alerting;
- privacy retention.

### DECISION A-05 — external API/webhooks

Self-service API keys/webhooks **не являются launch requirement**. Если внешний API появляется позже, первый supported contract предназначен authenticated partners/Pro/integrations. Anonymous public read-only API не открывается автоматически. Internal endpoints не являются public compatibility contract.

### DECISION A-06 — DRM target

DRM-модуль не является частью текущего closed-beta runtime, но DRM capability подтверждена как target commercial architecture. Seller включает DRM по продукту/SKU opt-in. Universal runtime, lease/grace, transfer и privacy правила описаны в `17-DRM-AND-LICENSING.md`; cryptographic implementation всё равно требует отдельного threat model.

---

## 28. Техническое определение «готового NEXUS» для первой production-версии

Минимально:

- reproducible build;
- clean migrations;
- production config validation;
- private uploads;
- working scanner;
- correct authentication/recovery;
- safe resource publish/claim/download;
- live server directory with bounded external dependency behavior;
- working moderation queues;
- RU/EN critical journeys;
- mobile/desktop usability;
- backup/restore rehearsal;
- exact-SHA release evidence;
- rollback/recovery procedure;
- no unresolved P0 release blockers.

## 29. Round 6 architecture consequences

- After login routing keeps user on Home; `/workspace` is a unified permission-aware management surface.
- Security Center becomes a first-class authenticated surface.
- Quarantine is a separate build/resource state/action, not equivalent to deletion.
- Admin global search must cross entity identifiers while enforcing staff permissions.
- Raw PSP/provider payloads require a restricted capability and audit.
- Dependency graph is a real domain relation; compatibility inference is not.
- Immutable User ID remains the durable identity key; vanity username is presentation/discovery metadata.
- External API is post-launch/optional and begins authenticated, not anonymous.
- No public Status Page requirement; internal observability remains production-critical.


## Round 9 architecture sync

Production marketplace storage direction is now explicit: private object storage is the artifact origin and downloads use short-lived signed/authorized delivery, optionally through CDN. Local filesystem remains a dev/test implementation. Scanner integration should be adapter-based with ClamAV as baseline and room for additional engines/reputation services. Payment provider logic remains behind provider adapters until production legal/provider selection.