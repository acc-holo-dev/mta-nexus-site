# MTA NEXUS — карта бесплатной закрытой беты

Дата сверки: **2026-09-24**. Проверенный код D4: **bb1ea0aaff2ce0909499ba822c389e44840ab9fa**. Все семь заданий прошли: четыре в [основном CI](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648476), два в [Account browser](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648596) и [Directory browser](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648416). Vitest — **257 тестов в 65 файлах**; Chromium D3-01 и D4-01 подтвердили enrollment и anonymous one-time password reset без внешнего SMTP.

**Решение о публичном выпуске не принято.** BETA-001–003 подтверждают хранение и запуск в CI; BETA-004 — ограниченный путь каталога; BETA-005a/b/c — перечисленные операции аккаунта. D1–D4 добавляют proofs, очередь, leases, закрытый TLS transport/runtime, durable limits, verified-email binding и tested forgot/reset application flow. **Production recovery по-прежнему не включён:** реальный provider/inbox, production keys, supervised dispatcher и rollout policy не приняты. R4 остаётся открытым. Процент готовности не назначается.

Полный аудит файлов, безопасности и старых идей не выполнен. Существующие среды с данными не обследованы и не считаются пустыми. В этом шаге `main`, рабочие серверы, существующие аккаунты, почтовые провайдеры, реальные ключи/секреты и платёжные настройки не менялись; публичного развёртывания не было.

## 1. Что выпускаем и как читать документы

Цель — бесплатная закрытая бета: игрок находит сервер, следит за обновлениями, общается и получает бесплатные ресурсы; автор и владелец сервера управляют публикациями; модератор разрешает обращения. Это не весь релиз 1.0 из [Product Blueprint](PRODUCT-BLUEPRINT.md).

Сохраняем ограничения: официальный MTA master-list вместо обязательного игрового агента, модульный монолит, один экземпляр приложения на бюджетном VDS, приватное локальное хранение файлов, отсутствие реального движения денег. RU/EN наследуется из Blueprint и не исключается молча.

[README](../README.md) — вход и Docker-only quickstart. [Blueprint](PRODUCT-BLUEPRINT.md) — желаемый продукт, не доказательство реализации. Эта карта — приёмка и очередь задач; [AUTH](AUTH.md) — действующие правила; [ACCOUNT-RECOVERY](ACCOUNT-RECOVERY.md) — внутренние примитивы и отдельно будущая доставка/привязка/reset. [Deployment](DEPLOYMENT.md) — правила эксплуатации. Roadmap и PLAN-STATUS сохраняют историю, но их галочки не заменяют проверку. [Legacy Migration Map](LEGACY-MIGRATION-MAP.md) предусматривает выборочный перенос, не объединение старого репозитория целиком.

Явные решения ответственного за продукт имеют приоритет; изменение границ записывается с причиной. Неутверждённая идея не становится принятой из-за появления в документе.

Вне ближайшей беты остаются платежи, баланс для трат, выплаты, крипторасчёты, runtime-DRM, обязательные агенты, рекламная платформа, мобильные приложения и сложное масштабирование. Наличие `/community` не доказывает готовности полноценных сообществ с членством и сложными ролями.

## 2. Статусы и доказательства

| Статус | Значение |
|---|---|
| Подтверждено CI | Конкретная проверка прошла на указанном SHA; вывод ограничен её содержимым. |
| Частично подтверждено | Есть проверенные части, но не весь пользовательский путь. |
| Не проверено | Достаточного свидетельства нет; функция не объявляется отсутствующей или сломанной. |
| Блокер | Расхождение или неподтверждённое критическое условие не позволяет одобрить выпуск. |
| Требует решения | Нужны явные границы продукта или эксплуатационная политика. |
| Отложено | Возможность сознательно не входит в ближайший выпуск. |

При закрытии задачи записываем SHA, среду, команду/сценарий, ожидаемый и фактический результат, ссылку и ограничения. Наличие файла/API/теста не доказывает успех. Результат старого SHA не переносится автоматически на новый коммит или обновлённый образ. Обязательные проверки, доставка артефактов и ручной просмотр изображений учитываются отдельно.

## 3. Подтверждённая автоматическая база

Текущие результаты относятся к **`bb1ea0aaff2ce0909499ba822c389e44840ab9fa`**, а не к следующему документационному коммиту или одобренному релизу.

| Проверка | Свидетельство | Граница вывода |
|---|---|---|
| Миграции, TypeScript, Vitest, сборки приложения и production-образа | [Verify](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648476/job/107603645793): success; 257/257 тестов, 65/65 файлов | Не полный dependency/security audit. |
| PostgreSQL и сохранность нового тома | [PostgreSQL persistence](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648476/job/107603646580): success | Не перенос рабочей БД и не backup restore. |
| Docker-only локальный запуск | [Local Docker startup](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648476/job/107603646360): success | Linux x86_64, миграции, HTTP/storage и замена app; другие платформы не приняты. |
| Production-образ, Caddy/TLS и зависимости | [Production Docker startup](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648476/job/107603646407): success | Новые тома, CI-надстройка, loopback и временный CA; не public DNS/ACME/VDS. |
| Регистрация, вход, выход и выбранная private-граница | [Account access and logout](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648596/job/107603646349): success; D3-01, D4-01 и J2-01..11 | Реальный Chromium/production TLS/DB; synthetic recovery delivery, не real inbox. |
| Известный пароль и сессии | [Password and session security](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648596/job/107603646769): success; P1..P11 | D4 отдельно проверяет reset; P10 всё ещё явно подменяет только 503 для UI. |
| Каталог в браузере | [Guest server directory](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35990648416/job/107603645214): success | Управляемые ответы directory API не доказывают весь backend-путь и MTA-клиент. |
| Proofs D1 и зашифрованная постановка D2a | Прежние 27 + 15 + 15 тестов проходят в том же Verify | Синтетические аккаунты/привязки, не реальное владение почтой. |
| Получение, retry и завершение задания D2b | account-mail-worker.test.ts: 29/29 в Verify | DB-протокол, включая остановку дочернего процесса; SMTP и естественное ожидание всех интервалов не проверялись. |
| Скриншоты и ручная визуальная приёмка | Не выполнены этим шагом | Историческая проблема квоты не устранялась; успех browser job не подтверждает доставку/просмотр изображения. |
| Полные J1–J7, RU/EN и общая доступность | Частично / не проверено | Отдельные успешные сценарии не закрывают весь продукт. |
| Scanner-вердикты, публикация и HTTP download | Не приняты полностью runtime | Старт ClamAV не доказывает безопасный путь архива. |
| Рабочая среда, backup restore и почта | Не проверены | Одноразовый runner и очередь в БД не заменяют эксплуатационную приёмку. |

Уровни прежних тестов сохраняются: auth-real проверяет сервисы/репозитории; server-directory-surface, server-claim-workflow и community-vertical ищут строки; resource-delivery использует тестовый scanStatus: clean и читает stream напрямую; public-platform-journeys сам создаёт уведомление и обновляет рейтинг. Они полезны, но не являются полной пользовательской приёмкой.

## 4. Матрица пользовательских сценариев

| ID / кому нужно | Действие человека | Подтверждено / остаётся |
|---|---|---|
| J1 — гость / игрок | Найти сервер, понять свежесть данных и подключиться | BETA-004: поиск, страницы, пустые/ошибочные ответы, неизвестный онлайн, Connect/Copy, ограниченные keyboard/mobile. Открыты backend-фильтрация с управляемым upstream, другие браузеры, RU/EN, визуальная приёмка и установленный MTA-клиент. |
| J2 — владелец аккаунта | Зарегистрироваться, войти, защитить доступ и видеть свои приватные данные | BETA-005a/b/c: вход/выход, cookie/replay, выбранная изоляция, пароль и сессии. D1/D2a/D2b — внутренние примитивы; реальное recovery, все private-сущности, security/cache/history-аудит открыты. |
| J3 — владелец сервера | Создать профиль, подтвердить управление и редактировать свои данные | Структурная проверка заявки и выбранные ownership/private-проверки. Полный путь нового владельца, доказательство управления, конфликт заявок и защита live-онлайна не приняты. Создание профиля не доказывает владение сервером. |
| J4 — автор | Получить доступ к публикации, загрузить архив, пройти scanner/модерацию | Есть сервисные тесты/adapter; тестовый автор уже developer. Onboarding обычного автора, HTTP upload, вердикты/тайм-ауты и запрет публикации непроверенного открыты. |
| J5 — получатель | Получить бесплатный ресурс и скачать разрешённую версию | Есть сервисные тесты. Открыты HTTP download, повтор без дублей, отказ анониму/чужому и запрет неопубликованной/отозванной сборки. |
| J6 — участник | Читать, подписаться, получить уведомление о событии и обсуждать | Реальная цепочка публикация → уведомление → правильная страница, настройки, ответы и защита черновиков не приняты. [Daily Experience](https://github.com/acc-holo-dev/mta-market-platform/blob/36471a09efaad8ba533917dd62d87069c6b4f9b5/documents/product/DAILY-EXPERIENCE.md) — продуктовый источник, не runtime-доказательство. |
| J7 — модератор | Обработать жалобу, заявку и сборку с объяснением и аудитом | Структурные/прямые report-проверки не закрывают все UI/API-действия, чужую роль, повтор и аудит. |

Общая приёмка: понятные подписи, loading/empty/error, узкий экран, клавиатура, RU/EN и ручная визуальная проверка. Один экран и Chromium не закрывают всю доступность.

## 5. Реестр расхождений и решений

| ID | Состояние и ограничение |
|---|---|
| R1 — PostgreSQL | Старый mount исправлен, новые тома проверены; старые среды требуют инвентаризации, backup и плана переноса. |
| R2 — Docker-only | Local/production-пути проверены в CI, рабочая среда не принята. |
| R3 — scanner | Старт проверен; вердикты и fail-closed публикация требуют отдельной приёмки. Модерация не заменяет scanner молча. |
| R4 — восстановление аккаунта | D0–D4 закрывают application-side pipeline для ordinary password accounts: verified binding, neutral forgot request и one-time reset проверены в CI/browser. Real provider/inbox, production keys/supervised worker и privileged/MFA/legacy rollout не приняты. Следующий D5 — operational delivery/rollout; R4 открыт. |
| R5 — выпуск | Разработка в dev, выпуск только по явно одобренному SHA/тегу main; совпадение веток не означает deploy. |
| R6 — удобство | Ограниченные английские сценарии пройдены; RU/EN, визуальная и полная доступность открыты. |
| R7 — эксплуатация | Домен/VDS/контакты/backup не подтверждены; проверить фактическую среду. |
| R8 — Caddy | Передача ACME_EMAIL исправлена после воспроизведённого отказа; CI подтверждён. |
| R9 — production startup | Исправлен non-root запуск без изменения root-owned зависимостей через pnpm. Root-права приложению не выдавались. |
| R10 — артефакты | Историческая квота не исправлялась; текстовые доказательства независимы, новая ручная визуальная приёмка не выполнена. |
| R11 — private public-route | BETA-005a защищает проверенные поля HTML/metadata `/servers/[slug]`; не доказательство всех маршрутов или рабочего инцидента. |
| R12 — формы аккаунта | Исправлены демо-реквизиты формы, постоянный Sign In и пустой displayName. Старые seed-аккаунты этим не удалены. |
| R13 — известный пароль | Атомарный хеш/отзыв/ротация/аудит; D1/D2a проверяют связанную инвалидацию proofs/очереди и откат. |
| R14 — ручной отзыв | Атомарный отзыв/аудит и повторная проверка инициатора; 17 регрессий сохраняются, не гарантия всех HTTP-гонок. |

## 6. Очередь небольших шагов

| ID | Состояние |
|---|---|
| BETA-001 | PostgreSQL 18 и новые тома: выполнено в CI, не перенос рабочих данных. |
| BETA-002 | Docker-only запуск: выполнено на Linux x86_64; остальные платформы отдельно. |
| BETA-003 | Production startup в CI: выполнено в описанных границах, не deploy. |
| BETA-004 | Функциональная browser-часть J1 выполнена; полный J1 открыт. |
| BETA-005a/b/c | Перечисленные операции аккаунта/пароля/сессий выполнены, не весь J2. |
| BETA-005d — в работе | D0–D4 выполнены в своих границах. **Следующий D5:** real-provider delivery, worker supervision/key lifecycle и rollout policy; production mail пока disabled. |
| Остальные BETA-005 | Recovery, onboarding автора, scanner и HTTP delivery: отдельные задачи. J2/J4/J5 целиком не закрыты. |
| BETA-006 | J3/J6/J7: заявки, публикации/подписки, модерация и негативные проверки. |
| BETA-007 | RU/EN, доступность, тексты и ручная визуальная приёмка обязательных путей. |
| BETA-008 | Restore БД/файлов, домен/контакты, эксплуатация, нагрузка и явный допуск. |

### Сохранённая история BETA-001–005d/D2a

Подробные результаты, неудачи и ограничения сохранены на закреплённых версиях, а не переобъявлены доказательствами текущего шага:

- [BETA-001](https://github.com/acc-holo-dev/mta-nexus-site/blob/c4b6dd622e50d806242cd4f7ffd051866f6949d1/docs/RELEASE-READINESS.md): отказ mount, исправление, строки/кластер/том и разделение Node/Vitest.
- [BETA-002](https://github.com/acc-holo-dev/mta-nexus-site/blob/2013a88a08acc267e61cb39fe7ac3d4da0a25a1d/docs/RELEASE-READINESS.md): local app/PostgreSQL/ClamAV, миграции/storage, non-root/loopback и замена app. Seed не автоматический, исходники требуют пересборки.
- [BETA-003](https://github.com/acc-holo-dev/mta-nexus-site/blob/31fd37df7971653b8315603d6d17c715aeadce75/docs/RELEASE-READINESS.md): отказы Caddy/pnpm, временный CA, startup/replacement и DB 503/recovery; не public ACME/restore.
- [BETA-004](https://github.com/acc-holo-dev/mta-nexus-site/blob/b3eb45cc6cda8f76d50f0c9872d2f5c37dd7dcac/docs/RELEASE-READINESS.md): 11 directory-проверок, разовое наблюдение источника и artifact quota; не весь backend или гарантия свежести.
- [BETA-005a](https://github.com/acc-holo-dev/mta-nexus-site/blob/31093883bd5901668d9d09e990b3de6509140b7c/docs/RELEASE-READINESS.md): 10 auth-сценариев и private HTML/metadata. Селектор исправлен; streamed HTTP 200 без проверяемых приватных полей не объявлен HTTP 404.
- [BETA-005b](https://github.com/acc-holo-dev/mta-nexus-site/blob/8b5448d9a83469bb14386d2d34babea2324f3f1f/docs/RELEASE-READINESS.md): ротация пароля/токена, шесть DB и 11 browser-проверок; первая ошибка типов исправлена, не скрыта.
- [BETA-005c](https://github.com/acc-holo-dev/mta-nexus-site/blob/03465c6a76f5949897ab0367f591f2fa04d715a3/docs/RELEASE-READINESS.md): 17 DB-регрессий и 143 теста на 170345e; атомарный аудит и наблюдаемое ожидание блокировок.
- [D0](https://github.com/acc-holo-dev/mta-nexus-site/blob/435bb05601115c22afb5ad7d609da35f4868decc/docs/ACCOUNT-RECOVERY.md): инвентаризация и проект канала/доставки/приёмки, не готовое recovery.
- [D1](https://github.com/acc-holo-dev/mta-nexus-site/blob/3758215102e063e4e1f73706f1984bdefc372341/docs/RELEASE-READINESS.md): миграция 0012, 27 новых и 170 общих тестов на 6bfebbe; синтетическая привязка не доказывает владение ящиком.
- [D2a](https://github.com/acc-holo-dev/mta-nexus-site/blob/2a1b9e567d6ba626a4f53e9d1a947b06d369f1ce/docs/RELEASE-READINESS.md): миграция 0013, атомарная зашифрованная постановка, 30 новых и 200 общих тестов на cec998f. Чтение после смены экземпляра key ring не было process-restart или SMTP-проверкой.

### BETA-005d/D2b — получение задания, повторные попытки и завершение

**Выполнено в границах внутреннего DB-протокола и изолированного CI.** Код `1aaeef2c2a8f5becf5f2d22d3a55f4ad8b2f076c`; шесть изменённых файлов относительно предыдущей dev: миграция 0014 и журнал, модель mail, worker-репозиторий, его tests и дочерний test fixture. UI, HTTP-handlers, зависимости, Compose и workflow не менялись. Worker не экспортирован из общего @nexus/db, не подключён к расписанию или SMTP.

Задание получает секретный lease не более 60 секунд и не дольше proof/инициирующей сессии; в БД хранится digest. Максимум пять получений, включая погибший до отправки процесс. Retry сохраняет задержку 5/30/120/300 секунд, прежние proof/token/ciphertext и expiry. Старый lease после повторного получения не может подготовить письмо или изменить результат новой попытки.

Перед claim, prepare и settle повторно проверяются user, адрес, версия, назначение, исходная сессия либо binding/provenance, role/MFA и срок по wall clock PostgreSQL после всех ожиданий. Порядок блокировок начинается с user, а не outbox, чтобы не инвертировать порядок credential-trigger. Prepare проверяет и GCM, и совпадение recipient/token с proof. При ошибке ключа не используется plaintext fallback.

Удаление/перепланирование задания и минимальный аудит имеют один commit; при отказе аудита состояние очереди сохраняется. Системный исполнитель указан как `system:account-mail-worker`; секретов и адреса получателя в событии нет. Очистка удаляет до 100 expired/exhausted envelope, не разрушая provenance. Активный пятый lease может закончить работу и не удаляется только из-за числа попыток. Автоматическое расписание не добавлено.

#### Фактические результаты

| Группа | Проверенный результат |
|---|---|
| Миграция и старое pending-задание | Тот же SQL 0014 выполнен в уникальной схеме поверх 0012/0013. Контрольные user/payload сохранены; attempts = 0, lease отсутствует, доверие к почте не создано. |
| Конкурирующие обработчики и два аккаунта | Ровно один claim одного задания; независимые задания доступны; чужой job ID с чужим lease не даёт plaintext и не принимает outcome. |
| Retry и stale owner | В БД сохраняется задержка; повтор использует прежний proof/token/expiry; старое разрешение не может подготовить, удалить или подтвердить новую попытку. |
| Пять попыток и cleanup | После предельного retry ciphertext удаляется, proof не расходуется; активный пятый lease сохраняется, заброшенный исчерпанный очищается. |
| Acceptance/discard и аудит | Повтор не создаёт второй успех; accepted означает явный тестовый outcome, не фактическую отправку. |
| Ошибка аудита: accepted, retry, discard | Три настоящих конфликта PostgreSQL 23505 откатывают удаление/перепланирование; исходное состояние строки и право действующего обработчика сохраняются. |
| Контекст аккаунта | Отозванная/заменённая/истёкшая сессия, изменённая версия, новая MFA/admin-роль и удалённый/заменённый/чужой provenance binding не дают plaintext. |
| Ключ и содержимое | Нет нужного ключа или envelope содержит другой token — общий отказ; задание остаётся для явного retry/discard. |
| Reissue и consumption | Старое leased-задание удаляется; ошибка защищаемого действия восстанавливает его вместе с proof. |
| Четыре наблюдаемых ожидания блокировки | После user/outbox wait повторно проверяются отозванный инициатор, lease и proof expiry; ложного success-аудита нет. |
| Остановка отдельного процесса | Дочерний Node выполнил committed claim и был завершён SIGKILL; задание осталось, другой экземпляр получил его после ускоренного тестового expiry, старый lease отклонён. |

**29/29 новых тестов прошли; весь Vitest — 229/229, 60 файлов.** В просмотренном Verify: Ubuntu 24.04.5 x86_64, Node 26.0.0, TypeScript 7.0.2, Vitest 5.0.1, PostgreSQL 18.6. Миграции, полные типы и сборки выполнены в GitHub Actions. Локально у ассистента проверялся только синтаксис новых TypeScript-файлов; локальных DB/build/runtime-результатов не заявляется.

Произведённый Verify образ — `sha256:5abed4b1e93d28c3ea0527fe5057147b6b22ba5362350059f07f69cf085037f5`. Это локальный результат runner, не опубликованный установочный образ и не развёртывание.

В crash-тесте остановка процесса реальна, а **lease_expires_at синтетической строки намеренно ускорен SQL-изменением**; 60 секунд естественного ожидания не проверялись. Другие retry-тесты ускоряют availableAt только собственных записей и не доказывают выдерживание всех интервалов в реальном времени. Четыре lock-wait теста наблюдают pg_blocking_pids; порядок не угадывается фиксированной паузой. Миграционная репетиция не является clone рабочей БД или восстановлением backup. Реквизиты, lease из IPC и содержимое письма не печатались fixture в отчёты.

#### Ошибка первого прогона и повторная проверка

Первая реализация `182360d` остановила [Verify](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35956424574/job/107495615968) на TS2769: в новой вставке аудита отсутствовал обязательный actorId. На этом прогоне новые DB-тесты ещё не выполнялись. Исправление `1aaeef2` добавило фиксированного системного исполнителя; схема, assertions и обязательные jobs не ослаблялись. Именно второй кодовый SHA подтверждён полным зелёным набором выше.

Существующие account/password/directory browser jobs повторены на том же исправленном SHA. Новых browser-тестов восстановления нет: пользовательского маршрута ещё нет. Историческая квота артефактов не исправлялась, просмотр новых изображений этим шагом не подтверждён.

#### Границы результата

**Lease защищает согласованность очереди в БД, но не обещает ровно одну внешнюю SMTP-отправку.** После prepare и освобождения блокировок контекст может измениться, а plaintext в памяти зависшего процесса нельзя отозвать. Будущий транспорт обязан соблюдать sendBefore, ограничивать время сети, отменять просроченную попытку и не удерживать DB-транзакцию во время I/O. Возможный повтор после неопределённого acceptance использует то же письмо/proof; сервер проверяет одноразовость при применении.

В тестах accepted передаётся явно, без SMTP. Отметка transport acceptance не доказывает inbox delivery. Нет SMTP-адаптера, полного dispatcher/scheduler, испытания сетевых отказов around acceptance, реальной ротации ключей, устойчивых адресных/IP-лимитов, нейтральной входной public-очереди, HTTP-временного профиля, CSRF и форм. Удаление ciphertext из живой таблицы не стирает WAL/backups. Не все сочетания блокировок/очистки, все HTTP-гонки или нагрузочные сценарии проверены.

Нет реального подтверждения ящика, полного reset со всеми эффектами, приёмки D3/D4 и политики включения. Весь J2, security/dependency review, RU/EN, визуальная приёмка, другие платформы и рабочая среда остаются открытыми. Миграция применялась только в тестовых средах; реальные аккаунты не подтверждены, не удалены и не заблокированы автоматически.

### BETA-005d/D2c — закрытая TLS SMTP integration

**Выполнено в границах тестового транспорта и dispatcher на 7b2629d34101101602125a79ef5c111a33cb7a6f.** Добавлены внутренние AccountMailSmtpTransport и AccountMailDispatcher, unit-тесты dispatcher, закрытый Docker receiver и отдельная integration-проверка в Verify. Production Compose, публичные HTTP routes, зависимости приложения и реальные SMTP credentials не включены.

SMTP использует implicit TLS с проверкой сертификата и без plaintext fallback. Сетевой I/O начинается после commit D2b prepare и заканчивается до отдельного settle, поэтому DB write transaction не удерживается во время SMTP. 4xx планируется как retry, 5xx как discard. Ошибка/timeout после передачи DATA помечается retry + uncertain: это не ложный success, но возможна повторная доставка того же письма. После подтверждённого 250 settle удаляет outbox и пишет существующий system audit.

Dispatcher строит только фиксированные account-security шаблоны. Base URL обязан быть HTTPS; challenge ID передаётся как query metadata, token — во fragment. Summary содержит только счётчики. Receiver и integration harness не печатают recipient, token или body. Нет доказательства, что внешняя почтовая система/ящик получил сообщение.

Закрытый receiver запускается как disposable node:26-alpine на loopback host port. Runner генерирует однодневный self-signed certificate с SAN localhost и передаёт его test client как явный CA только в положительных случаях. Проверены: accepted 250, temporary 451, permanent 550, потеря соединения после DATA, delayed final response/timeout, реальное отклонение self-signed cert без CA и disposable queue -> worker -> SMTP -> accepted audit/removal. Container удаляется через if: always() и не имеет внешнего relay.

account-mail-dispatcher.test.ts добавляет 7 unit-проверок; общий Vitest вырос с 229 до **236/236, 61/61 файлов**. Закрытая SMTP integration — отдельный шаг Verify и не входит в это число. Все четыре CI jobs, два Account browser jobs и Directory browser job прошли на том же SHA.

Первый D2c SHA d6c19cd не дошёл до assertions: root integration script не мог разрешить package-local drizzle-orm при strict pnpm layout. 6dc1245 затем обнаружил ложный negative-TLS test: helper с default CA возвращал доверие при undefined. Окончательное исправление 7b2629d запускает harness из @nexus/db и создаёт untrusted client действительно без CA. Эти два красных прогона не считаются подтверждением функции; тесты/requirements ради зелёного результата не удалялись.

**Ограничения:** SMTP AUTH и STARTTLS не реализованы; выбран только тестируемый implicit-TLS контракт. Нет production key loading, provider secret lifecycle, background scheduler/process supervision, реальной ротации ключей, адресных/IP abuse limits, публичного нейтрального request endpoint, измерения timing enumeration, D3 enrollment или D4 reset. Успешный SMTP 250 означает acceptance тестовым receiver, не inbox delivery. Реальные пользователи и рабочие данные не затронуты.

### BETA-005d/D2d — explicit runtime и durable abuse limits

**Выполнено на `e7dd6d8e18ca27dd5bcb233b8f5b9ebaf794d10c`.** Добавлены standalone runtime parser/loop, отдельное закрытие DB pool, migration 0015 и PostgreSQL-backed abuse-limit repository. Production Compose и app process worker не запускают.

Runtime требует отдельный 32-byte base64url mail key и key ID; совпадение с AUTH_SECRET запрещено. App URL обязан быть HTTPS, SMTP identity/port/servername/from и timeout заданы явно. CI генерирует одноразовые synthetic mail/abuse keys, запускает worker one-shot, затем continuous loop, посылает SIGTERM и проверяет быстрый clean exit. Missing mail key fail-closed; stdout/stderr проверены на отсутствие тестовых ключей. D2c receiver остаётся закрытым и не relay наружу.

Migration 0015 хранит request scope, keyed HMAC subject digest, count и fixed window timestamps. В новых тестах разные scopes/keys разделены; два repository instances видят один persisted limit; шесть concurrent attempts при limit=3 дают ровно три success и три reject; synthetic expiry reset и bounded cleanup проверены. Raw synthetic subject не находится в subject_digest. Этот repository пока не вызывается HTTP-кодом, поэтому не считается активной anti-abuse policy.

Vitest вырос с 236 до **247/247 tests, 63/63 files**: 6 runtime tests и 5 abuse-limit tests. Verify также прошёл migrations, typecheck, Next build, production image и отдельные D2c/D2d integration steps. Local Docker, PostgreSQL persistence, Production Docker, два Account browser jobs и Directory browser — success на том же SHA.

История отказов сохранена:
- `d7592bf`: malformed CI insertion не создала основной workflow jobs; исправлено восстановлением known-good YAML.
- `252e3cb`: loop обработал SIGTERM, но Node process удерживал postgres-js pool до idle timeout; добавлен explicit close.
- `04fe45f`: runtime step прошёл, typecheck нашёл unsafe RowList cast; исправлена структурная типизация.
- `eeffccb`: typecheck прошёл, PostgreSQL test выявил несовместимую передачу Date в raw postgres-js timestamptz parameters; теперь ISO + explicit cast.

Ни один из этих промежуточных прогонов не считается D2d acceptance. Assertions, TLS checks и browser regressions не отключались.

**Ограничения:** worker не supervised и не включён в production; реальные provider credentials/AUTH/STARTTLS не проверены; ключи не размещались в VDS secret store и ротация не репетировалась; abuse primitive ещё не связан с public route, поэтому отсутствуют final normalization, IP/email composition, timing-enumeration и response policy. Нет D3 binding, D4 reset, inbox delivery, реального scheduler/service manager или backup restore.

### BETA-005d/D3 — verified recovery email enrollment

**Выполнено на `68942511d666e970f28b7686deca5939cd9064df`.** D3a добавляет authenticated GET/POST/PATCH contract и provenance-backed binding; D3b — Settings UI, explicit confirmation page и real Chromium acceptance. Production Compose не активирован.

POST доступен только действующей сессии обычного password-account, требует current password и durable limit до issue. Он ставит encrypted `email_verify` envelope через существующий atomic D1/D2 producer и не возвращает challenge/token. GET status private/no-store и read-only. PATCH consume + binding + consume audit + binding audit выполняются в защищённой транзакции; другой аккаунт и replay rejected. Legacy verification flags не считаются mailbox ownership; admin/moderator/MFA остаются gated.

Confirmation link использует query challenge + fragment token. Chromium проверил, что fragment удаляется из history до user action, token не находится в URL/localStorage/sessionStorage/rendered body, а открытие страницы не меняет verified state. Confirm выполняется keyboard Enter на 390×844 viewport, после чего status verified=true, replay rejected и Settings показывает verified state без повторной кнопки.

CI-only delivery fixture не является почтовым provider: disposable overlay получает случайные masked producer/abuse keys, а guarded helper внутри disposable app-container расшифровывает только synthetic `@example.invalid` outbox row. Token не выводится в test reports/summary/artifacts. D2c отдельно остаётся evidence SMTP/TLS transport; D3 не переобъявляет его inbox delivery.

D3a `3ade27d` впервые дал 252/252 Vitest tests, 64 files и семь зелёных jobs. Финальный `6894251` сохранил **252/252, 64/64**, и все семь jobs зелёные. Account browser: D3-01 + J2-01..11 success; password/session suite success; Directory browser success.

История отказов сохранена: `eba13dc` — test TypeScript optional challenge ID; `4faebd9` — optional proof narrowing на confirmation retry; `06ac564` — новый recovery form добавил второй доступный label `Current password`, из-за чего строгие старые Playwright locators стали неоднозначными и каскадно сорвали password suite. Финальный `6894251` сузил только старые browser locators к форме `Change password`; продуктовый label и security semantics не ослаблялись.

**Ограничения:** standard production Compose не получает mail/abuse keys, держит email disabled и не запускает dispatcher. Нет real provider/inbox, anonymous forgot endpoint, reset mutation, final email/IP anti-enumeration policy, privileged/MFA recovery, legacy account transition, production secret storage/rotation или manual visual/RU acceptance.

### BETA-005d/D4 — anonymous forgot-password и password reset

**Выполнено на `bb1ea0aaff2ce0909499ba822c389e44840ab9fa`.** D4a добавляет neutral anonymous POST/PATCH service и atomic reset repository; D4b — forgot/reset UI и real Chromium acceptance. Standard production Compose не получает recovery keys и не запускает dispatcher.

Для валидного email POST возвращает одинаковый HTTP 202/body для eligible verified binding, unknown, unverified и rate-limited subjects. Route держит минимальный 350 ms response-time floor. До account lookup читаются отдельные mail/abuse keys. Durable keyed-digest limits: 3/hour для normalized email subject и 20/hour для IP subject; raw email/IP в limit table не хранится. Только current D3 binding может породить encrypted `password_reset` envelope.

PATCH использует one-time proof. Password hash считается до DB write transaction. Внутри protected consume одной транзакцией выполняются proof consumption, password update, удаление всех sessions, credential-trigger revocation остальных pending proofs, `user.password_reset` audit и in-app security notification. Audit-conflict regression подтверждает rollback password/session/proof/notification вместе. Reset не создаёт session; обычный login обязателен.

Browser D4-01 на production Next/TLS/PostgreSQL проверяет neutral body для известного/неизвестного адреса, timing floor, query challenge + fragment token, удаление fragment до действия, отсутствие token в storage/rendered URL, non-mutating page load, keyboard submit на 390×844, all-session revocation, no auto-login, отказ старого password, обычный login новым и replay rejection. Proof извлекается только guarded GitHub-hosted helper из synthetic `@example.invalid` encrypted outbox; внешний SMTP не используется.

Verify на финальном SHA: **257/257 tests, 65/65 files**. Все семь jobs success: CI `35990648476`, Account browser `35990648596`, Directory browser `35990648416`.

Сохранённая D4 история включает server/service и browser harness итерации. На `dbf646a` D4-01 дошёл до reset proof retrieval и выявил реальный test-fixture mismatch: helper выбрал `password_reset` row, но передал cipher AAD purpose `email_verify`; authenticated decrypt правильно отказал. Финальный `bb1ea0a` передаёт фактический purpose, не ослабляя production cipher. Прежние J2/password/session/directory regressions на финальном SHA зелёные.

**Ограничения:** 350 ms floor — заданный контракт, не полный статистический side-channel/load аудит. Нет real provider/inbox delivery, SMTP provider AUTH rollout, production recovery keys, supervised worker/service manager, secret/key rotation rehearsal, privileged/MFA recovery, legacy transition, manual visual/RU acceptance или environment backup/restore evidence. In-app security notification не доказывает внешнюю security-mail доставку.

### Следующий ограниченный шаг — D5

Провести эксплуатационную сквозную приёмку recovery delivery без публичного deploy: выбрать/сконфигурировать реальный provider mode, проверить AUTH/TLS и inbox delivery на тестовых адресах, supervised standalone dispatcher, restart/drain/observability, secret/key lifecycle и rotation/recovery; затем явно принять policy для privileged/MFA/legacy accounts и anti-enumeration/load bounds. Production activation остаётся отдельным release gate.

## 7. Условия допуска к выпуску

| Условие | Сейчас |
|---|---|
| Проверки точного кандидата | Семь заданий успешны на bb1ea0a; SHA не объявлен релизом, после изменений проверки повторяются. |
| Хранение и запуск | BETA-001–003 и повтор D2b подтверждены в CI; рабочая среда не принята. |
| Полные J1–J7 | Частично подтверждены, не закрыты перечнем подзадач. |
| Scanner и безопасный путь архива | Runtime-приёмка не завершена. |
| Восстановление аккаунта | R4 открыт: application-side binding + forgot/reset приняты в CI/browser, но real-provider/production delivery и rollout policy ещё не приняты. |
| RU/EN, доступность и визуальное качество | Общая приёмка открыта. |
| Восстановление БД и приватных файлов | Не проверено; сохранение тома не равно backup restore. |
| Security/dependency review, секреты, журналирование и контакты | Полный аудит не выполнен; страницы privacy/terms не заменяют проверку содержания. |
| Одобрение беты и среды | Не записано; карта не разрешает публичный запуск. |

Плановые вводные сохраняются: `nexus-mta.com`, резервный `nexus-mta.pro`, один VDS примерно $20–30/месяц; прежний ориентир Hetzner и 4 GB RAM. Это не подтверждение закупки, текущей цены или достаточности памяти. Нужны измерение конфигурации с ClamAV под согласованной нагрузкой и работающие `legal@`/`abuse@`. Выбранные backup VDS-провайдера должны пройти восстановление; дополнительные экспорты не вводятся как обязательная инфраструктура молча.

Перед изменением существующей среды нужны версия БД, фактические data_directory/mounts, проверенный backup и план переноса/восстановления. Запрещены `docker compose down -v`, `docker volume prune` и `docker system prune --volumes` на среде с существующими либо неизвестными данными. Очистка CI ограничена собственными одноразовыми ресурсами.

Платная коммерция — отдельный закрытый этап: модель деятельности, провайдеры, условия/возвраты, webhook verification, идемпотентность, сверка, выплаты и обязанности по продавцам проверяются отдельно. D4 его не включает и не подтверждает.

## 8. Как обновлять карту

Проблема человека → критерий приёмки → минимальное изменение → проверка → обновление соответствующей строки. Не закрывать несколько сценариев из-за общего сервиса и не создавать конкурирующие roadmap. Полный разбор архива идей остаётся отдельной работой.

Запись 2026-09-24 / D2b: добавлены persisted leases/attempts/retry и revalidation перед передачей plaintext/завершением; 29 новых тестов, в том числе дочерний SIGKILL и четыре наблюдаемых lock wait. Первый TypeScript-отказ из-за actorId исправлен отдельно. На 1aaeef2 подтверждены 229 тестов и семь CI/browser jobs. Документы AUTH/ACCOUNT-RECOVERY/эта карта приведены к результату, история D2a сохранена по закреплённой ссылке. Main, SMTP, реальные ключи, рабочие серверы и существующие пользователи не менялись; deploy не выполнялся. Следующий шаг — D2c, R4 открыт.
