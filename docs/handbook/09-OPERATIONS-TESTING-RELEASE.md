# MTA NEXUS — разработка, тестирование, CI, эксплуатация и релиз

> Статус: handbook v0.1.  
> Актуальные команды и runbook всегда перепроверять по `README.md`, `docs/OPERATIONS.md`, workflows и scripts текущего `main`.

## 1. Цель

MTA NEXUS считается рабочим не тогда, когда «страница открывается», а когда доказан весь критический путь:

- build;
- migrations;
- auth;
- storage;
- malware scan;
- public/private authorization;
- moderation;
- browser UX;
- backup/restore;
- deploy/recovery.

---

## 2. Канонический development path

### CURRENT

Основной локальный путь — Docker Compose.

```bash
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

или через package script:

```bash
pnpm dev
```

`pnpm dev` запускает preflight/doctor и тот же full Docker development stack.

### Почему Docker-first

Цель — убрать зависимость от случайного host setup:

- Node;
- PostgreSQL;
- ClamAV;
- environment;
- storage layout.

Host-only режим существует, но предполагает вручную подготовленные dependencies.

---

## 3. Development services

Стандартный stack включает:

- app;
- PostgreSQL;
- ClamAV;
- private local uploads.

Только app port публикуется на host loopback.

---

## 4. Repository doctor

Перед существенной работой проверяется:

- нужный repository/layout;
- tool versions;
- Docker/Compose;
- port availability;
- config files;
- renderability Compose;
- важные policy expectations.

### Принцип

Ошибку окружения надо отличать от дефекта приложения. AI-агент не должен «чинить код» только потому, что host запускает неподдерживаемую версию Node.

---

## 5. Database seed

Development seed:

- deterministic;
- transactional;
- serialized;
- idempotent для уже существующего baseline;
- не перезаписывает пользовательские изменения;
- проверяет identity conflicts;
- использует реальные ZIP fixtures с реальными size/hash metadata;
- отказывается работать как production provisioning.

### Repair mode

Специальный repair предназначен только для известных demo metadata mismatches.

Он не является универсальным «исправить всё» скриптом.

---

## 6. Testing layers

### Unit

Быстрые deterministic checks без database.

Проверяют:

- pure policy;
- parsing;
- validation;
- UI state logic;
- service contracts с mocks.

### Database/integration

Проверяют:

- SQL scopes;
- concurrency;
- unique constraints;
- transaction rollback;
- stale decisions;
- authorization against real PostgreSQL behavior;
- migration/data invariants.

### HTTP/route contract tests

Проверяют boundary behavior:

- status codes;
- target identity;
- malformed payloads;
- private/public caching;
- retry semantics;
- authorization.

### Browser acceptance

Реальные journeys:

- account/auth;
- server directory;
- resource creation/review/claim/download;
- RU/EN;
- mobile/desktop;
- keyboard/modal/search behavior;
- failure/retry paths.

### Tooling tests

Проверяют scripts/release/doctor behavior независимо от application tests.

---

## 7. Focused test groups

В root scripts существуют специализированные группы, включая:

- catalog;
- reports;
- verification;
- moderation queues;
- scanner;
- resource integrity;
- directory;
- tooling;
- database;
- unit.

### Принцип

Во время разработки запускать сначала focused suite, затем соответствующий broader gate.

Не требуется каждый микрокоммит прогонять через самый тяжёлый production rehearsal, но release candidate обязан пройти полный relevant acceptance.

---

## 8. CI philosophy

CI был сознательно упрощён по сравнению с избыточным набором jobs.

### CURRENT DIRECTION

- один основной coordinator workflow;
- unit и database разделены;
- production image собирается один раз на SHA и переиспользуется;
- обычный code change запускает быстрый достаточный контур;
- full/infrastructure/browser acceptance запускается при release-sensitive условиях или явно.

### Почему

CI должен ловить регрессии, а не превращать каждый маленький edit в многократную сборку одного и того же приложения.

---

## 9. Обязательные gate classes

Перед release candidate должны быть доказаны как минимум:

1. repository identity;
2. clean working tree;
3. migrations;
4. lint;
5. typecheck;
6. unit tests;
7. database/integration tests;
8. production build;
9. critical browser journeys;
10. production startup/readiness;
11. backup/restore evidence;
12. security-critical infrastructure paths.

---

## 10. Exact SHA principle

### DECISION

Нельзя говорить «release проверен», если:

- tests были на одном SHA;
- image собран на другом;
- deploy взял третий;
- после проверки рабочее дерево изменилось.

Release evidence должен быть привязан к exact commit SHA.

---

## 11. Release evidence

Проект имеет script/harness, который записывает gate results в machine-readable artifact.

### Требование

Artifact подтверждает то, что реально запускалось.

Если gate пропущен, он не считается PASS.

Если process завершился timeout/error, это failed/incomplete evidence, а не «скорее всего нормально».

---

## 12. Production image

Image должен быть:

- построен из exact verified SHA;
- воспроизводим;
- retained/identifiable для rollback;
- не зависеть от dev secrets;
- валидировать production config fail-closed.

### Restricted sandbox note

Webpack fallback может использоваться для диагностики окружения, где Turbopack не может открыть внутренний порт, но успешный альтернативный build не заменяет обязательный default production build gate.

---

## 13. ClamAV operational requirement

Production scanner должен быть настроен так, чтобы scan-limit/partial-scan не считался чистым.

В текущем Compose используется `AlertExceedsMax=yes`.

### Принцип

Неполная проверка = не доказано clean = не публиковать.

---

## 14. Upload limits

Upload boundary должен совпадать между:

- UI;
- request parser;
- application upload policy;
- storage;
- reverse proxy.

### Current scale

Текущая resource download/upload acceptance ориентируется на bounded artifacts порядка 64 MiB с proxy headroom.

Изменение лимита требует повторной оценки:

- RAM;
- hashing latency;
- scanner limits;
- proxy;
- browser Blob memory;
- timeout/retry UX.

---

## 15. Backup

Consistent backup — это пара:

- PostgreSQL dump;
- соответствующий uploads archive.

Плюс необходимо сохранять:

- checksum;
- previous application image identity;
- matching protected configuration/recovery keys.

### Critical rule

Нельзя делать «consistent backup» пока writers продолжают менять database/storage независимо.

---

## 16. Restore drill

Backup не считается проверенным только потому, что файл существует.

Нужно:

1. поднять чистую isolated environment;
2. восстановить DB;
3. восстановить uploads;
4. применить candidate migration/build;
5. проверить representative accounts/resources/entitlements/notifications;
6. сверить artifact checksums;
7. пройти critical browser/API journey.

---

## 17. Migration acceptance

Перед data-sensitive migration:

- посмотреть target inventory;
- проверить backup;
- оценить locks/DDL duration;
- прогнать на restored copy target-like data;
- иметь recovery decision.

### Current known example

Перед `0024_product_type_invariant` необходимо проверить распределение типов в настоящей target DB, чтобы unknown historical value не остановил migration неожиданно.

---

## 18. Rollback vs recovery

### Важно

После schema migration «просто запустить старый Docker image» может быть небезопасно.

Rollback application и rollback data — разные проблемы.

Поэтому deployment plan должен заранее определить:

- old image compatibility with new schema;
- migration reversibility;
- snapshot restore option;
- maximum acceptable data-loss window.

---

## 19. Production readiness

Перед публичным traffic:

- TLS;
- production secrets;
- mail/recovery path;
- private storage;
- scanner;
- DB persistence;
- migrations;
- readiness;
- backups;
- restore;
- moderation access;
- emergency access;
- logging;
- resource claim/download;
- account recovery;
- external MTA dependency behavior.

---

## 20. Current problem register snapshot

По `docs/PROBLEMS.md` на 2026-10-05 codebase не имел заявленного P0 blocker, но оставались реальные acceptance gaps.

### P1 direction

- lint warnings cleanup;
- target infrastructure validation;
- query plans;
- memory/disk;
- restored target DB acceptance.

### P2 direction

- external MTA/master/preview reliability;
- dev origin behavior;
- target browsers/devices and download load;
- production DB product-type inventory;
- test infrastructure cleanup/performance;
- host toolchain mismatch;
- dev DB pollution/hygiene.

### Meaning

«CI зелёный» не равно «production готова навсегда». Часть рисков существует только на target infra/data/load.

---

## 21. Browser coverage caveat

Chromium acceptance полезна, но не доказывает полную совместимость:

- Firefox;
- Safari;
- mobile OS download behavior;
- screen readers;
- real slow networks;
- production proxy/CDN behavior.

Перед широким release нужен небольшой target-device matrix.

---

## 22. Accessibility acceptance

Текущие важные базовые свойства:

- keyboard navigation;
- focus containment/restoration;
- native dialog semantics;
- skip-to-content;
- accessible search/autocomplete/dialog structure where those controls exist;
- localized labels;
- responsive overflow checks;
- reduced-motion consideration.

### OPEN

Перед production/public launch стоит определить минимальный WCAG target и выполнить focused manual/automated audit.

---

## 23. Security testing

Security checks должны охватывать не только dependency scanner.

Нужны:

- auth/session tests;
- rate-limit concurrency;
- ownership changes;
- org permission revocation;
- malformed request boundaries;
- private cache headers;
- upload scanner fail-closed;
- path/key safety;
- artifact corruption;
- report evidence URL validation;
- external link validation;
- production secret absence/failure.

---

## 24. Observability baseline — OPEN

Нужно формально зафиксировать до production:

- structured application logging;
- request correlation;
- error tracking;
- health/readiness;
- DB/storage/scanner health;
- disk capacity alert;
- backup failure alert;
- mail worker health;
- latency/error-rate metrics;
- MTA source outage indication.

### Privacy

Logs не должны содержать passwords, recovery tokens, session secrets, private license keys или raw sensitive evidence.

---

## 25. Incident classes

Минимально предусмотреть:

### Security incident

- credential/token leak;
- unauthorized access;
- malicious resource published;
- account takeover.

### Data incident

- DB corruption;
- migration failure;
- storage mismatch;
- accidental deletion.

### Availability incident

- app down;
- DB down;
- disk full;
- scanner unavailable;
- external MTA source unavailable.

### Trust/moderation incident

- malicious publisher;
- false verification;
- abuse-report backlog;
- compromised moderator/admin.

---

## 26. Release cadence — OPEN

Следует выбрать политику:

- continuous main + tagged candidates;
- periodic beta releases;
- semantic versioning cadence;
- maintenance windows.

Текущая версия `1.2.0-beta.3` не должна повышаться только потому, что появился новый commit.

---

## 27. Definition of Done для feature

Feature готова, когда:

- correct domain behavior реализован;
- authorization на server;
- validation на boundary;
- error states понятны;
- RU/EN учтены;
- mobile/desktop не сломаны;
- focused tests проходят;
- data/migration impact учтён;
- audit/notification semantics определены, если нужны;
- privacy/cache classification определена;
- docs обновлены, если изменился durable product/operational truth.

---

## 28. Definition of Done для release

Release candidate готов только если:

- exact SHA заморожен;
- required gates фактически PASS;
- target configuration готова;
- backup/restore проверены;
- production data migration reviewed;
- critical browser journeys пройдены;
- P0 отсутствуют;
- P1 release-impacting issues либо закрыты, либо явно приняты владельцем;
- rollback/recovery plan существует;
- production deployment отдельно авторизован человеком.



## Round 9 owner sync — production infrastructure gates

- Real payment integration remains provider-agnostic until legal entity, jurisdiction, provider contracts, refund/chargeback/accounting rules and settlement are approved at the production gate.
- Production commercial artifacts target private object storage and signed CDN delivery. Local filesystem storage remains a development/test fallback.
- ClamAV remains the baseline scanner, but scanner integration must be adapter-based so additional antivirus/reputation engines can be added without rewriting publishing/download workflows.
- The required observability **capabilities** are clear (central logs, metrics, error/tracing, uptime, backup monitoring, security alerts), but Round 9 did not approve who chooses the concrete vendors/tools. Treat vendor selection authority as OPEN.