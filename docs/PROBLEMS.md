# PROBLEMS — реестр открытых проблем MTA NEXUS

Единственный реестр проблем проекта. Обновлён: 2026-10-09 (после ограничения параллельных записей сборщика наблюдений; текущий hosted-runner blocker зафиксирован ниже).

Правила реестра:

- каждая проблема имеет приоритет, описание, доказательство и следующий шаг;
- закрытая проблема удаляется из реестра в том же коммите, который её закрыл
  (история — в commit messages и CI evidence);
- проблемы не дублируются в других документах; OPERATIONS ссылается сюда.

Приоритеты: `P0` — блокер релиза, `P1` — существенная проблема качества,
`P2` — известное ограничение, требующее работы, `P3` — улучшение/гигиена.

---

## P0 — блокеры релиза

На `a7d6080` успешно завершились CI, Account browser,
Directory browser и Resource browser. Подтверждены production/local Docker,
PostgreSQL persistence, восстановление бэкапа, полный Verify и production mail
worker (TLS, аварийный перезапуск, штатное завершение и отказ без ключа).
Это проверка одноразового CI-стека, а не существующей production-инфраструктуры.
Обязательные status checks пока не настроены.

## P1 — существенные проблемы

### P1-1. Приёмка на целевой инфраструктуре

CI переработан: один workflow-координатор, отдельные параллельные unit и
последовательные database проекты, один кешируемый production-образ на SHA.
Быстрый контур включает оба тестовых проекта и короткий браузерный smoke;
полная приёмка запускается явно/по релизному тегу/при изменении инфраструктуры.
Пропущенный обязательный шаг не считается успешной приёмкой. Полный новый
контур успешно прошёл на `fde2721`: 930 unit и 203 database проверки, 109
Node-проверок, production/local Compose, SMTP worker и все браузерные сценарии.
На том SHA все 239 существовавших Vitest-файлов были распределены без пропусков и пересечений; текущий классификатор проверяет полный автоматически обнаруженный набор. Быстрый контур
подтверждён на `7a9539e`: оба тестовых проекта, tooling и production browser smoke
зелёные; тяжёлые инфраструктурные и полные браузерные задания пропущены.
В этом прогоне обнаружена и исправлена first-use гонка recovery rate-limit:
параллельные запросы теперь сериализуются по keyed digest до чтения окна. Production-образ
собирается один раз; обычное изменение приложения требует шесть заданий вместо
прежних девяти. Локально unit проходят за ~12 секунд; на GitHub их время зависит
от runner. На `c06da2e` `biome lint --max-diagnostics=200 .` и `tsc -b`
прошли без lint-диагностик; unit/tooling, sequential database tests,
exact-SHA production image и production browser smoke также зелёные.
Флейк recovery-теста account-mail worker устранён корректным IPC handoff с
ожиданием callback отправки lease, а не увеличением таймаута.
Локально PostgreSQL и Docker недоступны; интеграционные результаты берутся из CI.

Живая приёмка больших портфолио закрыта: Chromium проверяет разработчика,
пользователя и организацию с 125 безопасными ресурсами и 25 статьями,
RU/EN, ширины 390/1280 px, страницы за первыми 100 ресурсами, одинаковые
даты, устаревшие ссылки, исключение чужих/черновых/платных/небезопасных
записей и независимость resource/article пагинации. Сохранены скриншоты.
Полный Verify вызывает настоящие репозитории на временных таблицах с
10 128 ресурсами и 10 025 статьями, проверяет выбранные индексы и сохраняет
EXPLAIN ANALYZE/BUFFERS до и после миграции 0026.

**Следующий шаг:** проверить планы запросов, память/диск и критические сценарии
на восстановленной копии целевой БД. Синтетический CI-набор и Chromium не
подтверждают production-нагрузку или совместимость остальных браузеров.


### P1-2. GitHub-hosted runner не начинает `plan` job

Сборщик наблюдений запускает два независимых чтения одновременно и сохраняет
совпадения партиями до пяти параллельных записей. При ошибке он дожидается всех
начатых операций до закрытия соединения CLI и не запускает следующие партии;
уже завершённые транзакции могут сохраниться. Существующие ограничения среды,
лимит 500 и repository transaction/duplicate semantics не изменены.
Одиннадцать новых проверок используют synthetic repositories и настоящие
endpoint helpers; fixture из 500 записей занимает 100 виртуальных тактов вместо
500 при ограничении в пять операций. Локальный `check:code` прошёл 1310 unit,
178 tooling, typecheck, lint, Knip и архитектурную проверку. Это подтверждает
порядок выполнения и завершение операций при отказе, а не реальную пропускную
способность PostgreSQL или DB/browser приёмку.

Карточка ресурса одновременно запускает независимые чтения после успешного
preview; история сборок остаётся зависимой от текущего management decision.
Locale/session и public metadata/locale также стартуют вместе. Одиннадцать
проверок acquisition/page behavior используют удерживаемые Promise и SSR с
synthetic service adapters; проверены оба решения управления, отказ прав,
поздняя ошибка entitlement и отсутствие detail reads после denied preview.
Локальный `check:code` прошёл 1299 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Это подтверждение порядка запуска и UI, а не измерение
production SQL latency или живая DB/browser приёмка.

Глобальный поиск использует общий endpoint index для нескольких серверных
результатов, сборщик наблюдений также повторно использует этот helper.
Fixture с 10 000 наблюдений и 50 отсутствующими серверами показала сокращение
чтений адресов с 500 000 до 10 000; одиночный ранний match сохраняет прямой
поиск. Все 32 целевые проверки прошли. Полный локальный `check:code` прошёл
1293 unit и 178 tooling, typecheck, lint, Knip и архитектуру. Это проверка
количества операций и поведения с synthetic sources, а не production latency,
памяти под нагрузкой или DB/browser acceptance.

Контексты аккаунта читают выбранные организации участника одним `IN` запросом
с тремя колонками вместо до 50 поштучных чтений. Сохранены owner priority,
роли, исходный порядок членств, лимит, private headers и personal fallback.
Локальный `check:code` прошёл 1289 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Десять HTTP проверок и три проверки SQL/row mapping на настоящем
Drizzle builder с proxy driver не требуют БД. Интеграционный owner/revocation
сценарий дополнен проверкой доступного membership context, но PostgreSQL
локально недоступен; выполнение этой проверки и DB latency не подтверждены.

Polling колокольчика теперь выполняет последовательные чтения и отменяет
запрос при hidden/cleanup; запоздавший ответ не перезаписывает свежий UI.
Во время mark-all-read фоновое чтение приостановлено до повторной сверки
с сервером. Применён существующий private API helper, без новых зависимостей.
Локальный `check:code` прошёл 1281 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Новые проверки используют fake timers и SSR effect adapter;
три регрессии воспроизведены до исправления. Это проверка lifecycle запросов,
а не живая DOM/browser приёмка или production замер экономии трафика.

Публичные profile/server metadata и страницы теперь разделяют одно чтение
записи в рамках RSC-запроса, locale также мемоизирован на время запроса.
Реальный RSC renderer development/production прошёл 40 synthetic renders с
параллельными RU/EN запросами, повторным запросом и missing → created.
Локальный `check:code` прошёл 1266 unit и все проверки кода; полный tooling
набор после добавления обоих RSC режимов содержит 178 успешных тестов.
Это подтверждает дедупликацию при синтетических репозиториях, а не реальные
DB-тайминги или приёмку production Docker/browser.

Локальный и CI unit-контуры теперь используют `pnpm check:code`: шесть
проверок выполняются последовательно, ошибки собираются за один запуск с
ненулевым итоговым статусом. Команда прошла локально: 1266 unit и 176 tooling,
lint, typecheck, Knip и архитектура. Ручной tokenizer тестовых импортов заменён
уже установленным SWC; семь новых fixture-проверок покрывают типы, templates,
typed mocks, computed importActual/unmock, partial mocks, CommonJS и отказ при
невалидном синтаксисе. Все 287 Vitest-файлов сохранили свои группы: 219 unit,
68 database. Эти проверки не подтверждают выполнение DB/browser/Compose.

Последующий browser-toolchain/fast-check slice объединил пять установок
браузерных инструментов в один источник версий. Реальная npm-установка профиля
`a11y` локально прошла. Также прошли 1266 unit, 169 tooling, frozen install,
typecheck, lint, Knip и архитектурная проверка. Четыре proxy/IP свойства проверены
по 1000 примеров на двух seed; найденный UTF-8 length exception воспроизведён
до исправления и устранён с регрессионной проверкой настоящих Fetch Headers.
Это самостоятельные проверки установки/защитного кода, а не выполнение
production Docker или browser acceptance.

В browser smoke и resource-browser добавлены axe-проверки WCAG для форм,
диалогов и авторизованных состояний RU/EN. Само падение gate при нарушениях и
сохранение диагностик проверяются отдельными Node-тестами с browser-adapter
fixture. Настоящий browser scan в текущей локальной среде не выполнен:
обычный Chromium не установился, альтернативный локальный binary не запускается.
До executable CI нет подтверждения axe baseline на production-образе;
найденные там нарушения нужно исправить, а не скрывать правилами/исключениями.

DEV Mailpit overlay добавлен в `Local Docker startup`: приёмка проверяет
worker health, непубликуемый SMTP, loopback UI и фактический TLS SMTP/API capture.
Локально прошли typecheck, lint, Knip, архитектурная проверка, 1261 unit,
163 tooling и 26 runtime/dispatcher тестов. Tooling включает настоящий TLS
handshake с генерируемым сертификатом и отказ при неверном hostname.
Docker в среде этой проверки недоступен; новая Compose-приёмка пока не выполнена.
Это не закрывает существующий hosted-runner blocker или production rollout.

После исправлений Web Push commit `0221f85` и все проверенные последующие
SHA получают один и тот же внешний симптом: job **Choose verification scope**
завершается `failure` до первого шага. GitHub Actions Jobs API возвращает
`steps: []`, `runner_id: 0`, пустые `runner_name` / `runner_group_name`;
job logs отсутствуют. Check Run при этом создаётся и содержит системные
annotations, то есть workflow зарегистрирован, но runner не назначается.

У run `37565630603` zero-step failure воспроизведён в трёх attempts, включая
отдельный rerun конкретного failed job. Симптом далее стабильно повторяется на
новых push-runs. Свежий run `37719493537` на `cab1c78` завершился тем же
образом: plan job `113123622340` имеет `runner_id: null` и `steps: 0`;
все executable jobs были пропущены до checkout/user code. Это подтверждает, что blocker пережил
durable Web Push queue alerting и safe public offline-cache refactor и не
привязан к конкретному workflow step. При этом последний полностью исполнившийся HEAD `7567191`
прошёл полный CI, а run `37565299572` на `3a1f818` ещё назначал runners,
запускал реальные jobs и дал обычные диагностируемые ошибки
typecheck/upgrade rehearsal.

Репозиторий private. Доступный GitHub connector не раскрывает account billing /
Actions minutes / repository Actions policy, поэтому причина (quota/billing,
repository policy или runner-side allocation failure) **не подтверждена**.
Публичный GitHub Status на момент диагностики показывал Actions operational,
так что глобальный outage также не подтверждён.

- **Влияние:** commits после `7567191` пока не получили executable exact-SHA
  CI, даже когда их ошибки проверены статически/математически.
- **Следующий шаг:** проверить GitHub Settings → Actions и Billing/usage для
  private repo/account; после восстановления hosted runner запустить полный CI
  на актуальном HEAD и закрыть этот пункт только после реального выполнения
  `plan`, unit/typecheck, migrations, Docker и browser acceptance.


### P1-3. Release upgrade fixture отставал от Web Push outbox

Upgrade rehearsal раньше отставал от Web Push outbox. Сейчас release contract
намеренно требует, чтобы target совпадал с последней migration journal entry.
После добавления Support idempotency target обновлён до
`0033_support_mutation_idempotency`: rehearsal проверяет Support tables,
все read-path индексы (requester, status, category+status, global staff order),
message-history index, Web Push subscriptions, outbox/gate/indexes,
rollback/retry, legacy rows и idempotency. Любая новая migration снова
заставит fixture fail-fast до review.

- **Статус:** исправлено в коде, но exact-SHA hosted CI всё ещё нужен после
  восстановления runner allocation.

### P1-4. Web Push external acceptance ещё не выполнена

Durable Web Push runtime, worker recovery, stale-subscription lease ownership, local TLS/SNI provider harness,
`Retry-After`, anti-SSRF, queue health/watchdog (включая корректный alert при ровно 100% capacity), serialized capacity gate с сохранением inbox при saturation и concurrent PostgreSQL
lease/settlement уже реализованы. Для двух оставшихся внешних доказательств
добавлены отдельные fail-closed инструменты:

- `pnpm push:soak` — fixture-only production-duration soak. Synthetic sender
  видит только собственный namespace, принудительно проходит 503→retry→201,
  проверяет exactly-once acceptance, drain, queue pressure и cleanup; artifact
  `artifacts/web-push-soak-evidence.json` имеет checksum и отдельный validator
  `pnpm push:soak:verify`;
- `pnpm push:provider:probe` — одноразовая отправка через настоящий production
  sender/VAPID/anti-SSRF к реальной browser subscription. Artifact
  `artifacts/web-push-provider-evidence.json` сохраняет только provider origin,
  SHA-256 endpoint/public-key fingerprints, HTTP status и timing; endpoint,
  p256dh/auth и private VAPID key в evidence не сериализуются. Validator:
  `pnpm push:provider:verify`.

Core `release:verify` теперь только ссылается на эти artifacts по
`present/valid/sha256` в отдельном `externalEvidence`; core
`releaseCandidate` намеренно не выдаёт их отсутствие за пройденную public
production acceptance.

- **Статус:** tooling готов, но evidence ещё не получена на staging/целевой сети.
- **Следующий шаг:** на изолированной staging-БД выполнить минимум 15-минутный
  soak с `NEXUS_WEB_PUSH_SOAK_ACK=YES`, затем live provider probe с реальной
  browser subscription и полным VAPID набором. Оба validators должны пройти;
  artifacts привязать к тому же release SHA. Не использовать production
  пользовательскую subscription/queue для synthetic soak.

## P2 — известные ограничения

### P2-1. Внешние ресурсы недоступны из сети владельца

`master.multitheftauto.com` (master-list) не отвечает даже с хоста —
похоже на региональную блокировку сети. Историческая зависимость fresh demo
seed от `images.unsplash.com`/DiceBear устранена: новый baseline не записывает
remote media URL и использует UI-fallbacks. Старые dev-тома могут адресно
очистить только точные legacy seed URL через `pnpm db:seed:repair-media`;
пользовательские replacements сохраняются. Live-серверы при недоступности
official master без настроенного mirror по-прежнему не отображаются.

- **Изменение:** master-list runtime теперь поддерживает до трёх явно заданных
  оператором HTTPS fallback endpoints через `MTA_MASTER_MIRROR_URLS`.
  Официальный `master.multitheftauto.com` всегда идёт первым; все попытки
  делят единый 10-секундный budget. Mirror обязан пройти тот же 8 MiB bound,
  ASE parser, server-count limit и EOF validation. Конфигурация отклоняет HTTP,
  credentials, IP literals, localhost/mDNS, single-label hostnames, нестандартный
  порт, дубли и больше трёх endpoints. Ошибка всех источников остаётся generic
  и не раскрывает operator endpoint клиенту.
- **Следующий шаг:** поднять/выбрать реально контролируемый mirror в целевой
  production-сети, настроить его через environment и подтвердить live refresh
  + stale fallback при недоступном official endpoint. Это изменение даёт
  безопасный механизм переключения, но само по себе не доказывает доступность
  какого-либо mirror. Для реальных пользовательских превью по-прежнему
  предпочтителен upload в контролируемое storage; fresh demo-data от внешнего
  image CDN больше не зависит.
- **Изменение:** превью ресурсов теперь скрывает недопустимые HTTP/HTTPS-адреса
  и показывает RU/EN-заглушку при ошибке декодирования или загрузки, включая
  кешированную ошибку до гидрации. Open Graph применяет ту же проверку URL.
  Browser-сценарий сломанного изображения прошёл на RU/EN в CI.

### P2-2. Dev-стек и нестандартные внешние hostname

Первоначальная проблема с Compose-hostname закрыта в CI: dev-конфигурация
разрешает стабильный service DNS `app` (и сохраняет совместимость с
`nexus-local-app-1`), а Chromium проверяет настоящий hydrated UI через
`localhost:3000` и `app:3000`. В обоих случаях theme toggle изменяет
DOM/localStorage, а login form отправляет client-side `POST /api/auth/login`
и не деградирует в нативный GET.

- **Остаётся ограничение:** произвольный LAN/IP/custom hostname намеренно не
  разрешён автоматически. Его нужно добавлять явным trusted dev origin, иначе
  Next.js dev-origin protections должны продолжать fail closed.
- **Следующий шаг:** отдельная работа нужна только если появится реальная
  потребность поддерживать конкретный LAN/custom dev hostname.

### P2-3. Скачивание: целевые устройства, браузеры и production-нагрузка

Реализованы настоящие ZIP для inventory и drift, транзакционный повторяемый
seed, проверка занятых ID/slug, сохранение пользовательских правок и явный
`db:seed:repair` для size/hash известных демосборок. Чужие файлы не заменяются;
модерационные статусы не сбрасываются. Изменённая версия/статус продукта
блокирует повторное добавление отсутствующей демосборки.

- **Проверено:** файловые и HTTP-тесты, логика транзакций с моками, типизация
  и сборка. Публичное и модераторское скачивание отклоняют известное
  несовпадение размера/хеша до аудита; исчезнувший файл возвращает 404.
- **Проверено 2026-09-30:** локальный provider хеширует открытый файл перед
  выдачей. Настоящее повреждение того же размера отклоняется обоими HTTP-
  маршрутами до аудита. Запись файлов атомарна; повторный ключ и проигравшая
  конкурентная запись не перезаписывают опубликованные байты.
- **Ограничение:** внешняя запись в тот же inode после проверки остаётся
  возможной; это не неизменяемый снимок файловой системы. Хеширование добавляет
  полное чтение с диска перед ответом — нужен нагрузочный замер. Чужие
  placeholder-файлы и временные файлы после аварийного завершения процесса
  требуют ручного разбора.
- **Проверено дополнительно:** длинные/Unicode имена архивов не входят в ключ
  хранения; идентификатор владельца проверяется до записи файлов.
- **Проверено дополнительно:** отмена запроса прекращает подготовку архива
  между блоками чтения и закрывает поток. Тесты покрывают отмену до открытия,
  во время хеширования, до/во время аудита и очистку обработчика отмены.
  Реальный обрыв HTTPS-соединения во время передачи и повтор проверены в CI;
  обрыв до ответа во время хеширования остаётся отдельной живой проверкой.
- **UI скачивания:** ошибки теперь остаются на странице ресурса с RU/EN
  сообщениями, прогрессом и отменой. Тесты клиента и серверного рендера прошли;
  Playwright-сценарии ошибки 409, тайм-аута, отмены и повторного скачивания
  прошли на `e05c75b`; проверяется SHA-256 реально сохранённого файла.
  Тайм-аут и отмена используют синтетический fetch. Реальный обрыв соединения
  до ответа при хешировании остаётся отдельной проверкой. На `e1bc341` Chromium скачал реальный файл
  64 МиБ на RU/EN с проверкой размера и SHA-256; неполный ответ и ошибка потока
  отклонены. Пиковая память и реальный сетевой обрыв ещё не измерены.
- **Проверено на `a7d6080`:** три настоящих HTTPS/TCP-обрыва после 1 МиБ,
  повтор с точным размером/SHA-256 и четыре параллельных медленных скачивания
  по 64 МиБ. RSS HTTP-процесса: 262 308 → 308 336 КиБ, прирост 46 028 КиБ
  (~45 МиБ), ниже бюджета 128 МиБ. Web Stream считает очередь по байтам
  (64 КиБ), включая модераторское скачивание. Это замер одноразового CI,
  а не памяти браузера/контейнерного кеша или production-пропускной способности.
- **Проверено на `33d400f`:** все четыре CI-процесса зелёные, 1063 теста.
  При загрузке 64 МиБ наблюдаемый прирост суммарного RSS процессов Chromium
  составил 117 652 КиБ (~115 МиБ), ниже бюджета 384 МиБ. Выборки с интервалом
  не менее 50 мс включают передачу, сохранение файла и освобождение handoff URL.
  Сумма RSS повторно учитывает общие страницы; это регрессионный замер, не точный
  пик физической памяти и не доказательство возврата к исходному уровню.
  Клиент хранит блоки в Blob вместо отдельного массива ArrayBuffer.
  TCP-обрыв во втором production-процессе Next.js после первого реального чтения
  64 КиБ остановил хеширование до второго чтения, закрыл файл без download-аудита.
  Повтор скачал 64 МиБ с точным SHA-256; процесс проверки штатно остановлен.
  Пауза чтения внедрена внешним preload только в CI; соединение loopback TCP,
  без Caddy/TLS. Обычная HTTPS-передача и её обрывы проверяются отдельно.
- **Следующий шаг:** проверить память и нагрузку на целевых данных/устройствах,
  другие браузеры и отмену до ответа через production-прокси. На PostgreSQL 18
  выполнить миграции, seed дважды,
  адресный repair и оба claim/download-сценария; проверить сохранность
  пользовательских правок и поведение реальных конкурентных транзакций.
  Seed-baseline integration и browser claim/download прошли в CI. Полное
  сочетание адресного repair с обоими деморесурсами отдельно не подтверждено.

### P2-4. Инвентаризация типов перед миграцией существующей production-БД

Миграция `0024_product_type_invariant` и оба product-types integration-теста
успешно выполнены на изолированном PostgreSQL 18 в CI `01f79da`. Это подтверждает
CHECK, известный алиас tool → plugin и отказ на неизвестных значениях.
Перед применением к существующей production-БД остаётся проверить распределение
типов и резервную копию именно этой БД; CI использует одноразовый набор данных.

### P2-5. Тестовая инфраструктура: хрупкости и производительность

- root `tests/` всё ещё содержит cross-workspace integration и часть
  legacy HTTP suites; Support status-vs-status и reply-vs-status mutations
  теперь используют PostgreSQL compare-and-swap contracts, поэтому stale
  moderation/reply не может silently вернуть thread в `open`. HTTP 409
  различает final closed case и concurrent message conflict, а client
  перечитывает authoritative thread перед показом ошибки; но ownership постепенно выровнен: comment repository
  contract живёт в `packages/db/src/repositories/`; comment form/client —
  в `apps/web/src/components/`; reports, verification, follow, article-comment
  и support HTTP suites перенесены непосредственно к своим Route Handlers.
  Focused `test:reports` и `test:verification` обновлены на новые пути.
  Verification proof URL parser снова синтаксически валиден (`http/https` only) и покрыт прямым HTTP regression; hosted runner не успел поймать этот build-blocker из-за zero-step allocation. Follow GET cache contract объединён с colocated follow suite, inbox /
  preferences / Web Push correlation suite перенесён к `/api/notifications`,
  а current-session, password-change и session-revocation HTTP contracts —
  непосредственно к auth Route Handlers. Root devDependencies остаются только
  для оставшихся cross-workspace suites; перенос продолжать по мере правок;
- private GET cache source policy заменён прямыми HTTP response assertions:
  auth context, notification preferences/inbox, reports, verification, follow
  и downloads подтверждают `private, no-store` + `Vary: Cookie`, а
  products/servers/content/search/MTA directory — явный public cache contract;
- surface-тесты сверяют точные строки исходников — ломаются при
  переформатировании; при правках предпочитать regex/поведенческие проверки.
  Discover query parsing/href contract уже переведён на прямую поведенческую
  проверку; active/expired session listing проверяется через реальный PostgreSQL
  repository contract, GET/DELETE session-management и password-change route —
  через HTTP behavior tests без чтения route source. Устаревший
  `account-security-surface.test.ts` удалён; PWA/Web Push surface tests теперь
  исполняют реальный service-worker source в изолированном VM и проверяют
  cache/offline/push/click поведение вместо совпадения строк. Report workflow
  больше не имеет дублирующего source-only теста: HTTP boundary + repository
  transaction/advisory-lock tests покрывают его поведением. Server-follow
  fanout переведён с чтения исходника на unit behavior (limit, author exclusion,
  concurrency, preference suppression и push failure), а comment notification
  path — на HTTP behavior; source-check оставлен только для внутреннего comment
  transaction/counter invariant без дешёвого unit seam. Free-resource acquisition
  больше не читает UI/repository source: claim/download/idempotency покрыты HTTP,
  PostgreSQL и browser journeys, а legacy checkout redirect — прямым behavior test.
  Build retirement source-policy заменён HTTP contract + PostgreSQL lifecycle
  integration (last published → draft, fallback published version). Closed-beta
  paid/product source policies теперь проверяются поведением: checkout 503 code,
  paid create/release rejection до write, free-only listing/public visibility и
  entitlement claim/check. Build moderation UI source-policy заменён pure UI-state contract + SSR
  reviewer-artifact behavior; reviewer bytes/moderation остаются под PostgreSQL/HTTP
  integration. Download route теперь прямо доказывает использование deterministic
  latest-published selector, поэтому отдельный source-only publication test удалён.
  Build moderation/quarantine policies используют service behavior guards поверх
  PostgreSQL/HTTP integrations:
  pending/CAS/scan provenance/release event и published/quarantined trusted-restore
  state machine. Discover/workspace source checks теперь заменены rendered navigation,
  compatibility redirect и SavedPage privacy/repository behavior; legacy commerce
  workspace routes вызываются напрямую. Public-resource availability source inspection также заменён: service detail fail-closed проверяется unit behavior, а catalog safe-build scope — реальным PostgreSQL переходом `no build → unsafe build → provenance-backed clean build`. Оставшиеся source-surface тесты сокращать
  по мере изменения функций. Content API/publication/moderation/feed source policies
  теперь заменены HTTP/service/schema behaviors: cache/auth/rate-limit, server-derived
  status authority, organization access, moderation CAS/audit и published detail/feed
  separation. Product review authority/integrity source checks также удалены:
  HTTP behavior покрывает auth/manager/entitlement/conflict boundaries, а
  PostgreSQL integration теперь проверяет concurrent aggregate serialization,
  DB uniqueness и fail-closed unpublished state. Server updates/reverse
  dependencies source suites тоже удалены: реальные PostgreSQL filters,
  server-detail parallel behavior, reverse summary bounds и rendered RU/EN
  unavailable/empty/list states покрывают контракт без чтения исходников.
  Public server-directory composition, resource trust/provenance chain и
  resource-detail acquisition UI также переведены с чтения JSX/source на
  HTTP/SSR behavior: localized directory shell, full recorded SHA/scanner/signature
  facts, free/paid/entitled/manager acquisition states и ровно один latest-build
  download action при длинной build history. Account recovery source checks
  заменены чистыми proof/history/request/timing contracts; admin content
  moderation — SSR behavior controls + HTTP/service tests; RU/EN root shell
  wiring — реальным RootLayout render вместо чтения JSX-файлов. Server
  experience source checks также удалены: live authority/management проверяют
  SSR behavior suites, create/update/follow/claim — confirmation parsers, а
  server client requests используют единый tested private API policy
  (`same-origin`, `no-store`, bounded timeout/caller abort). Generic
  client-mutation source inspection удалён: server/admin confirmations уже
  имеют dedicated behavior tests, notification preferences теперь имеют
  colocated canonical parser/confirmation suite, а private cache headers
  проверяются прямыми HTTP assertions;
- классификатор использует SWC AST вместо собственного tokenizer. Неизвестные
  динамические/неразрешённые импорты остаются консервативными, ошибка синтаксиса
  останавливает запуск с путём файла; это не полный evaluator произвольного кода;
- unit-проект уже выполняется параллельно четырьмя workers; только database
  проект последовательный из-за общих очередей и точных счётчиков. Следующий
  шаг — заменять оставшиеся проверки строк исходников поведением по мере
  изменения соответствующих функций;
- policy-тест документов (`tests/mainline-repository-policy.test.ts`) —
  источник правды по составу документации.

### P2-6. Хост-тулинг не соответствует engines

Хост: Node 22.23.2 / pnpm 12.4.1; проект требует Node ≥ 26 / pnpm 12.4.2.
Хост-скрипты `pnpm dev:docker:*`, `pnpm test:isolated` работают через Docker,
но host-side `pnpm check` без контейнера невозможен. pnpm-автоустановка
зависимостей при host-run создаёт лишний `node_modules` на хосте — установка
предотвращена (`verifyDepsBeforeRun: warn`).

Репозиторий явно пинит проверенный Node 26.10.0 одновременно через
`.nvmrc` и `.node-version`; `package.json#packageManager` остаётся
источником pnpm 12.4.2. `nexus:doctor` теперь сам сверяет оба Node-файла,
показывает pin в facts и при старом Node даёт конкретную подсказку `nvm use`;
contract-test не даёт version files разойтись.

- **Следующий шаг:** обновить сам хост до repository-pinned Node 26.10.0 и
  pnpm 12.4.2 либо держать разработку строго в Docker-пути.

## P3 — гигиена и улучшения

- **Dev-БД загрязнена тестовыми данными** (~1600 пользователей, `*_mum*`
  артефакты integration-тестов) — ожидаемо для dev; для чистых прогонов
  использовать `pnpm test:isolated`; при необходимости пересоздать том
  `nexus-local_pgdata` и накатить `pnpm db:seed`.
- **Проверять «живость» сайта браузером регулярно** — скрипты живого тура
  сохранены вне репозитория (`~/nexus-ux-audit/`), запускаются контейнерным
  Chromium против `localhost:3000` (установить: `apk add chromium` в dev-контейнер,
  `npm i playwright-core` в `/tmp` контейнера).

---

## Недавно исправлено (справочно, из истории)

- `5cd4f04`–`70e5c0e` — адресные пояснения Biome: группа ссылок и кнопки
  не является полем формы, ASCII-диапазон SMTP намеренный, тема использует
  статический локальный скрипт без пользовательских данных.

- `4be43ee`–`d7bf5a9` — адресные подавления `noThenProperty` для трёх
  намеренно awaitable моков Drizzle; переименование `.then` нарушило бы тест.

- `48d6f01` — каталог использует нативную область `<search>` вокруг формы.
- `3bd859d` — диалог закрывается кнопкой фона и Escape; фокус
  возвращается после закрытия.

- `17b95e5` — звёзды рейтинга используют фиксированные числовые ID.
- `7da7973` — повторяющиеся URL доказательств не создают дубли ссылок,
  уникальный URL служит ключом; ссылка получает читаемую подпись.

- `6cd0129`–`394d65c` — ID наблюдения проходит в историю сервера и
  используется как ключ столбца графика.
- `1f0cb38` — фиксированные ключи заглушек уведомлений.

- `0aa5bc8` — командная панель закрывается кнопкой фона; фокус поиска
  устанавливается при открытии и возвращается после закрытия.

- `2cfb4b4` — фиксированные идентификаторы ключей для четырёх loading-карточек.

- `43a996f` — объявление в `switch` маршрута follow заключено в блок.
- `60ccbd0` — счётчик оценок статьи доступен через видимый текст без
  неподдерживаемого `aria-label` на обычном `div`.

- `b33371a` — claim UI принимал 201 за ошибку; download 500→404 при
  отсутствии файла; home SSR ждал 10.1s у каждого посетителя при недоступном
  master-list (добавлен failure backoff, замер: 10.08s → 0.09s).
- `ea5235c` — восстановлена детерминированная верификация: root-тесты
  резолвят `next`/`drizzle-orm`; сериализация тест-файлов и сброс disposable
  очереди убрали межфайловые гонки; `.github` возвращён в docker-контекст;
  добавлен `pnpm test:isolated`.
- 2026-09-29 — ветки GitHub почищены (остался только `main`; бэкап-бандл
  всех веток: `~/backups/mta-nexus-site-all-branches-20260929-044934.bundle`);
  Docker очищен от ресурсов других проектов (~2.8 GB).
- `a93ed14` — датированные аудиты убраны из `docs/` (policy-тест), реестр
  проблем консолидирован в этот файл.

### P2. Browser retry restoration after a fresh login

Same-tab support form reloads now retain the opaque UUID and a SHA-256 digest of the normalized payload, plus the original reply status for at most 24 hours in sessionStorage. No subject or message plaintext is stored. Browser storage may be unavailable; the fallback is process-local only. A fresh login under a different user in the same tab can reuse a pending retry key, which the server scopes to the authenticated actor; it cannot expose another actor's result but may create a new support mutation. Before release, bind retry restoration to a non-sensitive identity/session discriminator and verify logout/account-switch behavior.
