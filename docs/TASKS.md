# Карточки задач MTA NEXUS

Сгенерировано из `planning/tasks.json`. Команды проверок в карточках — план проверки, а не выполненный PASS, пока `execution_state` не `done` и нет свидетельств. Читайте только выбранную задачу и её зависимости. Источники закреплены на baseline SHA. Рабочий tracker: [TRACKER.md](../planning/TRACKER.md).

## DOC-01 — Зафиксировать baseline решений и карту всех документов

**Фаза:** F0. **Приоритет:** P1. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Local inventory at 385e577e: 56 docs + README/AGENTS, 309 decision IDs, path consumers recorded in DOCS-MIGRATION.

**Исходные пункты:** DOC01. **Решения обсуждения:** NX-001, NX-007, NX-011.

**Сейчас.** Есть 56 docs Markdown; решения и сценарии распределены по handbook, пути читаются тестами и скриптами.

**Результат.** У каждой старой главы, стабильного decision ID и программного потребителя есть место в плане миграции.

### Область изменений

- `docs/handbook`
- `docs/PROJECT-MAP.md`
- `tests/mainline-repository-policy.test.ts`
- `scripts/observability-evidence-lib.mjs`
- `planned: planning/documents-map.json`

### Приёмка

- Зафиксированы HEAD и git status; все 56 документов учтены без объявления непрочитанного текста ненужным.
- Все исходные decision ID уникальны и сохранены с исходным статусом и ссылкой; отдельные требования вне реестра также включены в ручную семантическую проверку.
- Найдены Markdown-ссылки, readFileSync/policy consumers, упоминания старых путей и обязательных runbook markers.
- У каждого переноса указан target и критерий проверки смыслового сохранения; удаления пока не выполняются.

### Проверки при реализации

- node scripts/check-doc-links.mjs на текущем checkout
- rg по старым путям, decision ID и операторским marker-строкам; чтение контекста каждого потребителя

### Зависимости и условия

Без обязательных task dependencies.

Baseline пакета ускоряет работу; при изменившемся HEAD повторить инвентаризацию изменённых областей.

Release applicability: before_migrating_documentation.

### Источники

- [AGENTS.md · L1-L22](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/AGENTS.md#L1-L22)
- [tests/mainline-repository-policy.test.ts · L46-L95](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/tests/mainline-repository-policy.test.ts#L46-L95)

### Ограничения

- Количество файлов и совпадение ID не доказывают сохранение всех смысловых требований.

## DOC-02 — Интегрировать агентский вход, решения и ядро документации

**Фаза:** F0. **Приоритет:** P1. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Core docs integrated (AGENT/CURRENT-STATE/PRODUCT/DECISIONS/ROADMAP/TASKS/FLOWS/UX/RELEASE/RETENTION/planning); AI-007 reconciled; PROBLEMS merged; focused policy/link/operator checks passed. Full GitHub disposable acceptance not run.

**Исходные пункты:** DOC02. **Решения обсуждения:** NX-001, NX-007, NX-011.

**Сейчас.** Agent contract and DOC-02 integration are on tip; handbook register remains the baseline decision index.

**Результат.** Следующий агент начинает с одного контракта и понимает действующие решения, текущее состояние и границы задачи.

### Область изменений

- `AGENTS.md`
- `README.md`
- `docs/handbook/00-README.md`
- `docs/handbook/13-DECISION-REGISTER.md`
- `tests/mainline-repository-policy.test.ts`
- `planned: docs/AGENT.md`
- `planned: docs/CURRENT-STATE.md`
- `planned: docs/DECISIONS.md`
- `planned: docs/ROADMAP.md`

### Приёмка

- Обновлён README и root AGENTS; docs/AGENT.md ведёт к фактам, задачам и предметным контрактам.
- AI-007 согласован с действующим разрешением владельца; его ID и история сохранены, нет скрытого разрешения push/deploy.
- Реестр решений переносится со всеми действующими строками и статусами; NX-дополнения не заменяют baseline пересказом.
- Policy/link/operator consumers обновлены под новую структуру без удаления проверяемого инварианта.
- OPERATIONS остаётся по прежнему пути и сохраняет команды/markers до отдельного проверенного переноса.

### Проверки при реализации

- node scripts/check-doc-links.mjs
- pnpm test:focus tests/mainline-repository-policy.test.ts
- Релевантные operator/dev-startup suites, выбранные по rg
- Full acceptance согласно действующей CI-policy после интеграции

### Зависимости и условия

DOC-01

При отсутствии команды на реализацию пакет остаётся review draft. Эта карточка не включает GitHub push.

Release applicability: before_adopting_new_agent_contract_in_repository.

### Источники

- [docs/handbook/13-DECISION-REGISTER.md · L394-L403](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/13-DECISION-REGISTER.md#L394-L403)
- [scripts/ci-policy.mjs · L5-L28](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/ci-policy.mjs#L5-L28)
- [scripts/observability-evidence-lib.mjs · L74-L86](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/observability-evidence-lib.mjs#L74-L86)

### Ограничения

- Нельзя просто скопировать архив поверх репозитория: draft DECISIONS и PROBLEMS требуют интеграции baseline.

## DOC-03 — Выбрать и включить один рабочий tracker

**Фаза:** F0. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** github_settings.

**Заметка исполнения.** Selected JSON-in-repo as the sole working tracker; froze import-baseline; Issues import deferred pending github_settings permission.

**Исходные пункты:** DOC03. **Решения обсуждения:** NX-001, NX-007, NX-011.

**Сейчас.** JSON-in-repo выбран как единственный рабочий tracker; import-baseline заморожен; GitHub Issues не созданы.

**Результат.** Статус, исполнение и доказательство каждой задачи поддерживаются один раз.

### Область изменений

- `planned: planning/tasks.json`
- `planned: docs/ROADMAP.md`
- `planned: GitHub Issues / Project configuration`

### Приёмка

- Выбран JSON-in-repo или GitHub Issues; выбранный источник и переходный момент явно указаны.
- При импорте сохраняются task/source/decision/problem ID и зависимости; повторный импорт не создаёт дубликаты.
- Для Issues JSON становится зафиксированным import baseline, а ROADMAP содержит ссылки; вручную второй статус не обновляется.
- Внешние Issues/настройки создаются только в рамках соответствующего поручения; локально готовится проверяемый import.

### Проверки при реализации

- Валидация уникальности ID, полноты импорта и разрешения зависимостей
- Сверка выборки карточек с исходной приёмкой после разрешённого импорта

### Зависимости и условия

DOC-02

Работа над отдельно порученными задачами может идти до выбора tracker; это не universal blocker.

Release applicability: when_single_working_tracker_is_selected_and_migrated.

### Источники

- [docs/handbook/10-ROADMAP.md · L1-L20](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/10-ROADMAP.md#L1-L20)
- [AGENTS.md · L18-L22](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/AGENTS.md#L18-L22)

### Ограничения

- Импорт задач в GitHub не выполнен этим пакетом.

## DOC-04 — Удалить только доказанно лишние документы и мелкие файлы

**Фаза:** F0. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Deleted 49 superseded handbook chapters after retargeting consumers; kept 00-README, 13-DECISION-REGISTER, 15-AI-CONTEXT-INDEX; manifest planning/deletion-manifest.json; Git history retains full text.

**Исходные пункты:** DOC04. **Решения обсуждения:** NX-001, NX-007, NX-011.

**Сейчас.** Удалены 49 superseded handbook chapters после retarget consumers; сохранены 00-README, 13-DECISION-REGISTER, 15-AI-CONTEXT-INDEX; manifest planning/deletion-manifest.json; полный текст остаётся в Git history.

**Результат.** Уменьшить дублирование без потери правил, импортов, операторских сценариев и истории миграций.

### Область изменений

- `docs/handbook`
- `README.md`
- `tests/mainline-repository-policy.test.ts`
- `planned: deletion manifest for individually verified files`

### Приёмка

- На каждый кандидат удаления есть причина, новый владелец уникального содержания и найденные потребители.
- Ссылки и проверки перенесены; применённые миграции, lockfile, fixtures и scripts не признаются мусором по названию.
- Малые изменения сгруппированы по смыслу; нет массового форматирования несвязанных файлов.
- Снятые документы доступны через Git, а актуальный поиск ведёт к одному активному контракту.

### Проверки при реализации

- node scripts/check-doc-links.mjs
- rg по каждому удалённому пути и названию
- Focused consumer checks; интеграционный gate по фактическому diff

### Зависимости и условия

DOC-05

Удаление завершает перенос, а не предшествует ему.

Release applicability: after_semantic_migration_and_consumer_checks.

### Источники

- [scripts/check-doc-links.mjs · L41-L95](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/check-doc-links.mjs#L41-L95)
- [AGENTS.md · L16-L22](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/AGENTS.md#L16-L22)

### Ограничения

- Ни один файл не объявлен готовым к удалению лишь на основании этого пакета.

## DOC-05 — Свести предметные главы по пользовательским сценариям

**Фаза:** F0. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Subject contracts RESOURCES/COMMUNITY/SERVERS-ORGS/TRUST-STAFF/COMMERCIAL-FUTURE created; PRODUCT/ARCHITECTURE/PROJECT-MAP/indexes/FLOWS/UX/OPERATIONS cross-linked; handbook retained for DOC-04; groups/DM/events and collections≠server packs preserved; commercial goals without payment activation.

**Исходные пункты:** DOC05. **Решения обсуждения:** NX-001, NX-007, NX-011.

**Сейчас.** Предметные контракты RESOURCES/COMMUNITY/SERVERS-ORGS/TRUST-STAFF/COMMERCIAL-FUTURE созданы и связаны с PRODUCT/ARCHITECTURE/PROJECT-MAP/FLOWS/UX/OPERATIONS. Groups/DM/events и collections≠server packs сохранены; commercial goals без payment activation.

**Результат.** Сохранить уникальные owner-решения и подробные отказы/права в компактной структуре предметных контрактов.

### Область изменений

- `docs/handbook`
- `planned: docs/PRODUCT.md`
- `planned: docs/RESOURCES.md`
- `planned: docs/COMMUNITY.md`
- `planned: docs/SERVERS-ORGS.md`
- `planned: docs/TRUST-STAFF.md`
- `planned: docs/COMMERCIAL-FUTURE.md`

### Приёмка

- Для каждой строки documents-map прочитан и перенесён весь уникальный смысл, включая исключения и обязательства вне таблицы решений.
- Отдельно обозначены current runtime, owner target, proposal и live unknown.
- Группы/DM/events не объявлены готовыми по наличию support; коллекции не объявлены versioned server packs.
- Commercial/DRM цели сохранены без активации платежей и без потери lifetime/offline/revocation policy.
- FLOWS/UX/OPERATIONS содержат каждый свой authoritative контракт; перекрёстные документы ссылаются на него.

### Проверки при реализации

- Смысловая сверка старой и новой главы по inventory и всем decision ID
- node scripts/check-doc-links.mjs
- Policy/operator checks по затронутым путям

### Зависимости и условия

DOC-02

Можно переносить по одному предметному домену; не ждать окончания всех новых функций.

Release applicability: before_retiring_old_subject_chapters.

### Источники

- [docs/handbook/03-FEATURES-AND-SURFACES.md · L1-L19](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/03-FEATURES-AND-SURFACES.md#L1-L19)
- [docs/handbook/13-DECISION-REGISTER.md · L3-L19](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/13-DECISION-REGISTER.md#L3-L19)

### Ограничения

- Пакет даёт рабочие общие контракты; полное смысловое объединение всех 52 handbook глав остаётся этой задачей.

## OPS-01 — Закрепить границы модульного монолита и исключения HTTP → repository

**Фаза:** F1. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Architecture boundaries + cruiser exceptions documented; architecture-analysis node tests PASS.

**Исходные пункты:** ARC01, ARC02. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Границы модульного монолита и HTTP→service/repository exceptions зафиксированы; dependency-cruiser и architecture-analysis проверяют контракт. Точечные допустимые repository reads остаются только по списку исключений.

**Результат.** Описать и проверять границу составных service-команд без массового рефакторинга всех handlers.

### Область изменений

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `.dependency-cruiser.cjs`
- `scripts/tests/architecture-analysis.node-test.mjs`

### Приёмка

- Составные бизнес-изменения должны идти через service-команду; допустимые простые read/health исключения перечислены и объяснены.
- Правило не требует пустых service-обёрток и не меняет существующую авторизацию; новая запрещённая зависимость диагностируется.
- Packages не импортируют apps; domain остаётся независимым; UI не импортирует server packages.

### Проверки при реализации

- pnpm analyze:architecture
- node --test scripts/tests/architecture-analysis.node-test.mjs
- Проверить маленький запрещённый import только в disposable checkout; после удаления fixture анализ снова проходит.

### Зависимости и условия

Без обязательных task dependencies.

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/ARCHITECTURE.md · 7–23](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/ARCHITECTURE.md#L7-L23)
- [.dependency-cruiser.cjs · 3–44](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.dependency-cruiser.cjs#L3-L44)
- [apps/web/src/app/api/admin/actions/route.ts · 110–118](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/admin/actions/route.ts#L110-L118)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не менять security/INT или UI-сценарии под видом архитектурной уборки.
- Микросервисы, Redis и новая внешняя очередь не входят в задачу.

## OPS-02 — Сверять версию приложения и фактический toolchain кандидата

**Фаза:** F1. **Приоритет:** P2. **Решение:** proposal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Toolchain pins/node engines consistency; toolchain-pins + release-version-consistency PASS.

**Исходные пункты:** ARC03, ARC04, ARC05. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Версия приложения и toolchain pins согласованы в manifests/engines/.nvmrc/packageManager; focused toolchain-pins и release-version-consistency PASS. Host/CI Node pin и Docker base сверяются отдельно от major-ok engines.

**Результат.** Получать однозначную запись actual Node/pnpm/lockfile и проверять релизный policy без обновления зависимостей ради новизны.

### Область изменений

- `package.json`
- `.nvmrc`
- `.node-version`
- `pnpm-workspace.yaml`
- `scripts/nexus-doctor.mjs`
- `scripts/release-evidence.mjs`
- `scripts/tests/toolchain-pins.node-test.mjs`
- `tests/release-version-consistency.test.ts`

### Приёмка

- Pin-файлы согласованы, release-mode различает допустимый major и выбранный exact runtime.
- Manifest фиксирует actual runtime и lockfile hash; необъяснимое расхождение с утверждённым policy не становится PASS.
- Private package versions остаются едиными; TS6 analyzer exception сохранён, пока его замена отдельно не проверена.

### Проверки при реализации

- pnpm test:focus tests/release-version-consistency.test.ts scripts/tests/toolchain-pins.node-test.mjs scripts/tests/nexus-doctor.node-test.mjs
- pnpm typecheck
- pnpm analyze:architecture
- Сверить node/pnpm внутри disposable build/runtime image с release policy; не предполагать совпадение по строке тега.

### Зависимости и условия

Без обязательных task dependencies.

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: before_accepting_candidate_version_and_toolchain.

### Источники

- [package.json · 76–98](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/package.json#L76-L98)
- [pnpm-workspace.yaml · 11–22](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/pnpm-workspace.yaml#L11-L22)
- [scripts/nexus-doctor.mjs · 158–225](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/nexus-doctor.mjs#L158-L225)
- [.github/workflows/ci.yml · 57–67](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/workflows/ci.yml#L57-L67)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Изменение major/Next/React/TS не является автоматической частью задачи.
- Диапазон engines и exact release pin имеют разные функции; текущая несовместимость не заявляется.

## OPS-03 — Закрепить образы выбранного релиза и правила их обновления

**Фаза:** F1. **Приоритет:** P2. **Решение:** proposal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Infra pin schema + resolve-infra-image-digests; linux/amd64 digests resolved in deploy/infra-image-pins.json (productionAuthorized=false). Mutable compose tags retained for Dependabot. toolchain-pins PASS.

**Исходные пункты:** ARC07, ARC12. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Infra pin schema и linux/amd64 digests зафиксированы в deploy/infra-image-pins.json (productionAuthorized=false). Mutable compose tags сохранены для Dependabot; exact production digest enablement остаётся у OPS-16/17.

**Результат.** Сделать выбранные base/infra bytes повторно доступными по digest и сохранить проверяемый процесс обновления.

### Область изменений

- `Dockerfile`
- `compose.yaml`
- `compose.production.yaml`
- `compose.verify.yaml`
- `.github/dependabot.yml`
- `scripts/tests/toolchain-pins.node-test.mjs`
- `docs/OPERATIONS.md`

### Приёмка

- У release baseline записаны base/infra digest и platform; три Node stages следуют выбранному policy.
- Обновление digest создаёт проверяемое изменение; pin не блокирует бессрочно security updates.
- PostgreSQL остаётся на согласованном major 18 и правильном volume; major engine upgrade отделён от application migration.

### Проверки при реализации

- node --test scripts/tests/toolchain-pins.node-test.mjs
- Read-only проверка разрешённых image refs и merged Compose config в disposable среде.
- Использовать существующий full-acceptance image/persistence путь для изменённых infra refs; schema-upgrade PASS не считать проверкой engine major upgrade.

### Зависимости и условия

OPS-02

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: before_locking_selected_release_image_references.

### Источники

- [Dockerfile · 2–19](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/Dockerfile#L2-L19)
- [Dockerfile · 48–50](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/Dockerfile#L48-L50)
- [compose.production.yaml · 3–32](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.production.yaml#L3-L32)
- [.github/dependabot.yml · 39–46](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/dependabot.yml#L39-L46)
- [docs/OPERATIONS.md · 994–1012](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/OPERATIONS.md#L994-L1012)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Exact registry digests не известны из исходных tag-строк; их получают только при подготовке кандидата.
- Не менять PostgreSQL major, storage layout или рабочие volumes в этой задаче.

## OPS-04 — Описать и проверять допустимые Compose overlays и inventory ролей

**Фаза:** F1. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Compose overlay matrix + writer inventory documented; compose-overlay-matrix node tests PASS on host docker.

**Исходные пункты:** ARC09. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Dev, isolated verify, production base и CI overlay разделены; recovery/mail/file-secret overlays включаются отдельно. Порядок merge значим; CI требует Compose >=2.24.4.

**Результат.** Для каждого поддерживаемого сочетания получать предсказуемые services, ports, volumes и secret references.

### Область изменений

- `compose.yaml`
- `compose.production.yaml`
- `compose.production-ci.yaml`
- `compose.verify.yaml`
- `compose.recovery.yaml`
- `compose.mail-worker.yaml`
- `compose.recovery-file-secrets.yaml`
- `docs/OPERATIONS.md`
- `scripts/nexus-doctor.mjs`
- `scripts/tests/recovery-compose.node-test.mjs`
- `scripts/tests/mail-worker-compose.node-test.mjs`

### Приёмка

- Матрица содержит dev/verify/production/production recovery-mail/production CI и порядок overlay.
- Production итог не содержит dev source mounts/CI ports; CI-публикация остаётся loopback.
- Inventory перечисляет app, push, license, resource-release и реально включённые optional роли; file/env sources не конфликтуют.

### Проверки при реализации

- node --test scripts/tests/recovery-compose.node-test.mjs scripts/tests/mail-worker-compose.node-test.mjs scripts/tests/nexus-doctor.node-test.mjs
- В disposable среде выполнить docker compose config для каждого поддерживаемого сочетания с синтетическими values; не читать и не печатать production env.
- Сопоставить service inventory с runbook; статического config недостаточно для live readiness.

### Зависимости и условия

Без обязательных task dependencies.

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: before_operating_selected_compose_overlays.

### Источники

- [compose.yaml · 1–15](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.yaml#L1-L15)
- [compose.production-ci.yaml · 1–36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.production-ci.yaml#L1-L36)
- [compose.recovery-file-secrets.yaml · 1–27](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.recovery-file-secrets.yaml#L1-L27)
- [scripts/nexus-doctor.mjs · 261–281](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/nexus-doctor.mjs#L261-L281)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не объединять произвольно dev и prod base.
- Task не создаёт production secrets и не запускает контейнеры на сервере.

## OPS-05 — Доказать переносимость одного standalone image между runtime origins

**Фаза:** F1. **Приоритет:** P2. **Решение:** proposal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Runtime APP_URL vs build placeholders separated/guarded; same-digest two-origin contract tests; entrypoint 8 PASS + focused 44 PASS. Full check-production-startup.sh disposable CI remains external.

**Исходные пункты:** ARC06, ARC10, ARC11. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Runtime APP_URL отделён от build placeholders; same-digest two-origin contract покрыт focused/entrypoint tests. Full check-production-startup.sh disposable CI остаётся внешним gate.

**Результат.** Зафиксировать build/runtime границу и проверить продвижение одного image без пересборки под каждый домен.

### Область изменений

- `Dockerfile`
- `apps/web/next.config.mjs`
- `packages/config/src/index.ts`
- `scripts/start-production.sh`
- `scripts/check-local-readiness.mjs`
- `deploy/Caddyfile`
- `tests/config.test.ts`
- `tests/production-runtime-readiness.test.ts`
- `scripts/tests/production-entrypoint.node-test.mjs`

### Приёмка

- Один digest работает с двумя разрешёнными тестовыми HTTPS origins; ссылки и origin checks используют правильную конфигурацию.
- Серверные runtime URL и публичные build-константы разделены или явно ограждены; секреты не встраиваются в клиент.
- Неверный обязательный env не открывает HTTP; standalone, static, DB payload и все включённые entrypoints присутствуют.
- При отказе DB/storage readiness не сообщает готовность; публичный health не раскрывает полную конфигурацию.

### Проверки при реализации

- pnpm test:focus tests/config.test.ts tests/production-runtime-readiness.test.ts tests/production-tracing-bounds.test.ts tests/production-edge-security.test.ts scripts/tests/production-entrypoint.node-test.mjs
- Существующий scripts/check-production-startup.sh запускать только в disposable GitHub-hosted CI с его guards.
- Добавить проверку двух runtime origins в разрешённый image acceptance path; использовать один предварительно собранный image.

### Зависимости и условия

OPS-02, OPS-04

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: before_using_one_image_across_runtime_origins.

### Источники

- [Dockerfile · 20–70](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/Dockerfile#L20-L70)
- [packages/config/src/index.ts · 332–357](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/config/src/index.ts#L332-L357)
- [scripts/start-production.sh · 8–16](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/start-production.sh#L8-L16)
- [scripts/check-production-startup.sh · 4–21](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/check-production-startup.sh#L4-L21)
- [deploy/Caddyfile · 5–31](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/deploy/Caddyfile#L5-L31)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Текущего apps/web/public нет: не регистрировать отсутствие COPY public как дефект.
- Не включать rolling/multi-instance и не требовать новой публичной version endpoint.

## OPS-06 — Выбрать безопасный authoring path следующей forward-only миграции

**Фаза:** F1. **Приоритет:** P2. **Решение:** verification_required. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Forward-only authoring path documented/guarded; release-upgrade node tests PASS; no new generator DDL in main checkout. Tip journal advanced to 0089_resource_qa (90 SQL) via forward-only migrations 0088/0089; retained upgrade evidence baseline still targets 0087_server_reviews.

**Исходные пункты:** ARC14. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Journal содержит 90 SQL migrations до 0089_resource_qa, snapshots — только 0000/0001. db:generate вызывает обычный Drizzle generate. Конкретный будущий DDL не воспроизводился; текущая БД не объявлена неверной.

**Результат.** В disposable checkout проверить риск и документировать поддерживаемый manual/custom либо generator workflow.

### Область изменений

- `packages/db/package.json`
- `packages/db/drizzle.config.ts`
- `packages/db/migrations/meta`
- `docs/handbook/08-DOMAIN-AND-DATA-MODEL.md`
- `docs/OPERATIONS.md`
- `scripts/tests/release-upgrade.node-test.mjs`

### Приёмка

- Выбранный путь воспроизводим; применённые SQL/journal не переписаны.
- Если generate поддерживается: no-op не предлагает существующий DDL, небольшое изменение даёт только ожидаемый delta.
- Если выбран manual/custom: обычный generate явно ограждён, авторский путь и обязательные проверки описаны.
- Upgrade target по-прежнему соответствует последней миграции, retry/idempotency сохранены.

### Проверки при реализации

- Сначала копия checkout/временная ветка с disposable выходом генератора; pnpm db:generate не выполнять в основном checkout.
- node --test scripts/tests/release-upgrade.node-test.mjs
- При реальном новом SQL — существующий hosted-CI packages/db/scripts/check-release-upgrade.mjs; не снимать guards и не подключать рабочую БД.

### Зависимости и условия

Без обязательных task dependencies.

Условная предпосылка для любых задач других треков, действительно добавляющих SQL; не блокирует релиз без schema-change.

Release applicability: before_next_schema_change_using_authoring_path.

### Источники

- [packages/db/package.json · 8–10](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/package.json#L8-L10)
- [packages/db/drizzle.config.ts · 3–6](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/drizzle.config.ts#L3-L6)
- [packages/db/migrations/meta/_journal.json · 614–619](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/migrations/meta/_journal.json#L614-L619)
- [packages/db/migrations/meta/0001_snapshot.json · 1–10](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/migrations/meta/0001_snapshot.json#L1-L10)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не «чинить» applied history выравниванием snapshot.
- Предположение о повторном DDL не выдавать за уже полученный результат генерации.

## OPS-07 — Сделать upgrade-evidence validator строгим — F02

**Фаза:** F1. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Strict evaluateReleaseUpgradeEvidence; schemaVersion=1; legacy full fixtures still PASS; 51 node tests green.

**Исходные пункты:** ARC15, F02. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** evaluateReleaseUpgradeEvidence строгий: schemaVersion=1, неполный PASS отвергается; legacy full fixtures сохраняют PASS. productionAuthorized в локальных repro остаётся false — не live upgrade evidence.

**Результат.** Не допускать technical candidate PASS без обязательных identity, target, verification и cleanup доказательств.

### Область изменений

- `scripts/beta-candidate-lib.mjs`
- `packages/db/scripts/release-upgrade-contract.mjs`
- `packages/db/scripts/check-release-upgrade.mjs`
- `scripts/tests/beta-candidate.node-test.mjs`
- `scripts/tests/beta-candidate-surface.node-test.mjs`
- `scripts/tests/release-upgrade.node-test.mjs`
- `docs/OPERATIONS.md`

### Приёмка

- Missing/mismatch SHA, wrong baseline/target, incomplete phase и missing/false/wrong-type обязательные flags дают failed.
- Формат evidence версионирован; совместимость сохранённого полноформатного artifact явно определена и проверена без редактирования исторического evidence.
- Правильный exact-SHA artifact проходит; productionAuthorized остаётся отдельным от technical PASS.

### Проверки при реализации

- node --test scripts/tests/beta-candidate.node-test.mjs scripts/tests/beta-candidate-surface.node-test.mjs scripts/tests/release-upgrade.node-test.mjs
- Добавить негативные pure-helper cases в существующие тесты; проверить полный retained fixture и минимальный status-only PASS.
- Перед публикацией кандидата — существующий full_acceptance на новом exact SHA; не объявлять старый SHA приёмкой исправления.

### Зависимости и условия

Без обязательных task dependencies.

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: before_next_release_candidate.

### Источники

- [scripts/beta-candidate-lib.mjs · 185–245](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/beta-candidate-lib.mjs#L185-L245)
- [packages/db/scripts/release-upgrade-contract.mjs · 1–44](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/scripts/release-upgrade-contract.mjs#L1-L44)
- [docs/OPERATIONS.md · 964–988](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/OPERATIONS.md#L964-L988)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Это известный F02, не новая находка и не отмена успешного текущего CI.
- Не использовать обходы offline evidence/SHA policy; объявить их семантику явно.

## OPS-08 — Собирать release manifest и согласованный retention комплект

**Фаза:** F1. **Приоритет:** P2. **Решение:** proposal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Release manifest/retention contract + mismatch tests; ciArtifactDays=14; durable bundle retention still owner_decision (OPS-16). release-evidence* PASS.

**Исходные пункты:** ARC22, OPSNEW-08. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Release manifest/retention contract и mismatch tests на tip; ciArtifactDays=14. Durable bundle retention/publish остаются owner_decision (OPS-16) — не объявляется выполненным.

**Результат.** Связать идентичность исходников, образов, схемы и приёмки в один версионированный кандидатный документ с независимым от CI cache хранением.

### Область изменений

- `scripts/release-evidence.mjs`
- `scripts/release-evidence-lib.mjs`
- `scripts/beta-candidate-lib.mjs`
- `.github/workflows/ci.yml`
- `scripts/tests/release-evidence.node-test.mjs`
- `scripts/tests/release-evidence-surface.node-test.mjs`
- `docs/OPERATIONS.md`

### Приёмка

- Manifest содержит appVersion, exact SHA, actual toolchain/lockfile hash, image digest/platform, PostgreSQL major, schema baseline/target и migration hashes.
- Включены очищенный от секретов inventory overlays/ролей и ссылки на full CI/upgrade/backup/browser evidence.
- Retention утверждён владельцем отдельно от 14-дневного artifact: текущий и необходимые предыдущие release bundles/образы доступны после очистки CI cache.
- Нет автоматического productionAuthorized=true; отсутствие доказательств имеет явный статус.

### Проверки при реализации

- node --test scripts/tests/release-evidence.node-test.mjs scripts/tests/release-evidence-surface.node-test.mjs scripts/tests/fetch-beta-candidate-evidence.node-test.mjs
- Добавить проверки missing/mismatch digest/SHA/schema и неизвестной версии manifest в существующий evidence test path.
- pnpm release:verify — только после реализации в согласованном disposable verification окружении: команда выполняет gates, это не чтение JSON.

### Зависимости и условия

OPS-02, OPS-07

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: before_publishing_verified_release_bundle.

### Источники

- [scripts/release-evidence.mjs · 197–239](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/release-evidence.mjs#L197-L239)
- [.github/workflows/ci.yml · 653–661](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/workflows/ci.yml#L653-L661)
- [packages/db/scripts/release-upgrade-contract.mjs · 1–44](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/scripts/release-upgrade-contract.mjs#L1-L44)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Схема/сборщик manifest — новая работа, не уже реализованная возможность.
- Retention длительность и место не придумывать; рабочие backups и secrets не класть в release assets.

## OPS-09 — Подготовить private repository с реально действующей защитой main и release refs

**Фаза:** F1. **Приоритет:** P1. **Решение:** accepted_direction. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** github_settings.

**Исходные пункты:** OPSNEW-09. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Root подтвердил public personal repository, main без protection/rulesets; тариф неизвестен. Private branch protections/rulesets доступны personal Pro, но не Free.

**Результат.** После решения владельца о плане перевести видимость и защиты в согласованное проверяемое состояние, сохранив PR/CI review path.

### Область изменений

- `external: GitHub repository visibility, plan-supported branch/tag rules and required CI checks`

### Приёмка

- Владелец выбрал personal Pro либо иной поддерживаемый ownership/план; платная покупка/transfer не подразумевается.
- Только после явного разрешения проверены private visibility, доступ нужных людей/ИИ и действующий main rule: PR, CI result, force/delete ограничения и явный bypass policy.
- Release refs защищены от непреднамеренного изменения; неправильный check source/name не создаёт обход или вечную блокировку.
- Private environment reviewers на Pro/Team не обещаются; manual deploy остаётся отдельно.

### Проверки при реализации

- Read-only сверка repository visibility, effective protection/rulesets и owner-plan доступности до и после разрешённого изменения.
- В отдельной тестовой ветке/PR проверить failed CI → merge blocked и успешный выбранный scope → корректное разрешение; не тестировать force/delete на main.
- Сопоставить required check с существующим job name CI result в .github/workflows/ci.yml.

### Зависимости и условия

Без обязательных task dependencies.

Требуется решение владельца о тарифе/доступах; не зависит от покупок коммерческого контура NEXUS.

Release applicability: before_authorized_private_visibility_and_protection_change.

### Источники

- [.github/workflows/ci.yml · 619–661](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/workflows/ci.yml#L619-L661)
- [GitHub Docs: protected branches · 24–38](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Docs: environments · 25–44](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Permission обозначает требуемый отдельный допуск, а не выданное разрешение менять GitHub.
- Private не делает сайт закрытым: открытая бесплатная бета сохраняется.
- Не вводить фиктивного второго reviewer, если независимого человека нет.

## OPS-10 — Подготовить trusted GHCR publish workflow без повторной сборки

**Фаза:** F1. **Приоритет:** P2. **Решение:** proposal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Trusted ghcr-publish job prep: no PR packages:write; gated by NEXUS_GHCR_PUBLISH_ENABLED; restore+validate tar without rebuild. No image pushed. Needs OPS-11 enablement.

**Исходные пункты:** ARC08, ARC22, OPSNEW-10. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Trusted ghcr-publish job подготовлен: без packages:write на PR; gate NEXUS_GHCR_PUBLISH_ENABLED; restore+validate tar без rebuild. Образ не публиковался; enablement — OPS-11.

**Результат.** Добавить проверяемую подготовку/publish кандидата из тех же bytes только после full_acceptance доверенного exact SHA.

### Область изменений

- `.github/workflows/ci.yml`
- `scripts/ci-policy.mjs`
- `scripts/ci-summary.mjs`
- `scripts/validate-ci-image.sh`
- `scripts/tests/ci-policy.node-test.mjs`
- `scripts/tests/ci-image.node-test.mjs`
- `scripts/tests/ci-hardening.node-test.mjs`
- `docs/OPERATIONS.md`

### Приёмка

- PR и недоверенные refs не получают packages:write или deploy secrets; elevated permission только у конкретного trusted publish job.
- Publish требует full_acceptance exact SHA и использует ранее проверенный image без next build на сервере.
- Полученный registry digest/platform/source linkage записываются в manifest; mutable tag не становится production input.
- Отсутствующий cache/image не приводит к молчаливой непроверенной пересборке под прежним release identity.

### Проверки при реализации

- node --test scripts/tests/ci-policy.node-test.mjs scripts/tests/ci-image.node-test.mjs scripts/tests/ci-hardening.node-test.mjs
- Локально проверить матрицу trusted/untrusted events и scope guard существующими pure tests.
- Фактический registry push/pull — только в OPS-11/OPS-16 после отдельного разрешения; в этой задаче никакие внешние package не публикуются.

### Зависимости и условия

OPS-03, OPS-05, OPS-07, OPS-08

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: before_enabling_trusted_ghcr_publication.

### Источники

- [.github/workflows/ci.yml · 266–294](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/workflows/ci.yml#L266-L294)
- [scripts/ci-policy.mjs · 47–84](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/ci-policy.mjs#L47-L84)
- [scripts/ci-policy.mjs · 117–125](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/ci-policy.mjs#L117-L125)
- [compose.production-ci.yaml · 1–23](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.production-ci.yaml#L1-L23)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не давать write/deploy token всему workflow.
- Не считать workflow_dispatch независимым reviewer approval; publication и server deployment различны.

## OPS-11 — Принять private GHCR visibility и минимальные права доступа

**Фаза:** F1. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** external_gate. **Исполнение:** not_started. **Область полномочий:** github_settings.

**Исходные пункты:** OPSNEW-11. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Нужный private package и его настройки в этой работе не инспектированы. Repo privacy и GHCR visibility независимы; новый package по умолчанию private.

**Результат.** Подтвердить, что publish workflow имеет нужный доступ, а внешний consumer может только читать выбранный private package.

### Область изменений

- `external: GHCR package visibility, repository linkage and server read access`

### Приёмка

- После отдельного разрешения проверены namespace, private visibility, repository linkage/inheritance и Actions access.
- CI использует GITHUB_TOKEN с packages:write; pull credential — classic PAT read:packages плюс read-доступ пользователя, SSO при необходимости.
- Anonymous/unauthorized pull private image отклоняется; разрешённый reader получает approved digest и не может push/delete.
- Срок/отзыв credential определены; токен не находится в repository/image/logs. Если package уже public, его нельзя считать закрытым после смены repo visibility.

### Проверки при реализации

- Read-only package settings review без вывода credentials.
- После разрешения — scoped publish/read/negative-access probe в предназначенном для этого package; не удалять существующие release images.
- Сверить официальный GHCR authentication/access contract; fine-grained PAT не подменяет документированный classic support.

### Зависимости и условия

OPS-09, OPS-10

Развёртывание и хранение pull credential на production относятся к OPS-17, а не к GitHub settings task.

Release applicability: before_accepting_private_registry_access_for_delivery.

### Источники

- [GitHub Docs: GHCR authentication · 52–88](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitHub Docs: package visibility/access · 45–66](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)
- [GitHub Docs: public package irreversibility · 245–287](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не включать public image для удобства pull; уже public package не переключается обратно в private.
- Не создавать токены и не публиковать probe без отдельного внешнего разрешения.

## OPS-12 — Исправить maintenance writer inventory и порядок миграции — F05

**Фаза:** F1. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Maintenance writer inventory aligned with production/mail/recovery overlays; production-entrypoint + backup-restore-surface + release-upgrade PASS.

**Исходные пункты:** ARC13, ARC16, F05. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Maintenance writer inventory согласован с production/mail/recovery overlays; stop/resume включает штатные license/resource-release workers. App startup по-прежнему применяет forward-only migrations до HTTP.

**Результат.** Сделать исполнимый runbook консистентной паузы, одной migration phase и полного resume фактически включённых ролей.

### Область изменений

- `docs/OPERATIONS.md`
- `compose.production.yaml`
- `compose.mail-worker.yaml`
- `scripts/start-production.sh`
- `scripts/tests/production-entrypoint.node-test.mjs`
- `scripts/tests/backup-restore-surface.node-test.mjs`

### Приёмка

- Команды stop/resume учитывают app, push, license, resource-release, optional mail и отдельно объявленные внешние writers; PostgreSQL остаётся доступным для dump.
- Проверка подтверждает паузу application writes в согласованном окне; после обновления возобновляется тот же inventory с approved image.
- Сверяются migration ledger/target; HTTP/ingress не открываются после failed migration.
- Rollback описывает совместимость кода со схемой; старый image не объявляется откатом данных.

### Проверки при реализации

- node --test scripts/tests/production-entrypoint.node-test.mjs scripts/tests/backup-restore-surface.node-test.mjs scripts/tests/release-upgrade.node-test.mjs
- В disposable rehearsal проверить фактические процессы/записи и resume; одной проверки текста недостаточно.
- Полный existing hosted CI backup/upgrade/startup путь использовать после соответствующих изменений; production recipe здесь не выполнять.

### Зависимости и условия

OPS-04

Если задача затронет новый SQL, сначала OPS-06. Multi-instance coordination за пределами текущего single-instance release.

Release applicability: before_using_maintenance_recipe.

### Источники

- [docs/OPERATIONS.md · 1017–1044](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/OPERATIONS.md#L1017-L1044)
- [docs/OPERATIONS.md · 1062–1083](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/OPERATIONS.md#L1062-L1083)
- [compose.production.yaml · 141–191](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.production.yaml#L141-L191)
- [scripts/start-production.sh · 8–16](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/start-production.sh#L8-L16)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Известный F05 — не доказательство наблюдавшейся потери данных.
- Не использовать down --volumes, prune или seed на рабочем сервере.

## OPS-13 — Принять эксплуатационный backup/recovery contract — F04

**Фаза:** F3. **Приоритет:** P1. **Решение:** verification_required. **Очередь:** external_gate. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** F04. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Exact-SHA CI восстановил синтетическую DB/ledger/uploads после удаления source volumes. Production schedule, off-host retention и RPO/RTO из Git не доказаны; их отсутствие не установлено.

**Результат.** Подтвердить либо настроить недостающие части парного независимого резервирования и измерить реальное восстановление.

### Область изменений

- `docs/OPERATIONS.md`
- `scripts/check-backup-restore.mjs`
- `scripts/backup-restore-contract.mjs`

### Приёмка

- Владелец согласовал допустимую потерю данных/простой, retention, независимое расположение и доступ при потере основного хоста.
- Сохранён согласованный recovery set DB/uploads/image/config references; проверяются свежесть и результат каждой копии.
- На отдельно разрешённой защищённой репрезентативной копии проверены права, файлы, ledger и измеренное время/потеря данных относительно выбранных целей.
- Evidence содержит окружение/время/результат и ответственного без данных пользователей или секретов.

### Проверки при реализации

- node --test scripts/tests/backup-restore.node-test.mjs scripts/tests/backup-restore-surface.node-test.mjs — проверяют tooling, не production schedule.
- node --test scripts/tests/production-recovery-acceptance-evidence.node-test.mjs и node scripts/check-production-recovery-acceptance-evidence.mjs — schema/template validators (#191/#267); PASS на fixture ≠ закрытие F04/OPS-13.
- Read-only инвентаризация существующих backup jobs и последней успешной копии только после допуска к целевому окружению.
- Отдельно разрешённый off-host restore drill; scripts/check-backup-restore.mjs не направлять на рабочие volumes, его hosted-disposable guards сохраняются.

### Зависимости и условия

OPS-12

До хранения ценных данных/открытия трафика нужен внешний gate; конкретные RPO/RTO и storage/доступы выбирает владелец.

Release applicability: before_live_acceptance.

### Источники

- [scripts/check-backup-restore.mjs · 350–513](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/check-backup-restore.mjs#L350-L513)
- [docs/OPERATIONS.md · 989–1013](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/OPERATIONS.md#L989-L1013)
- [docs/OPERATIONS.md · 1017–1060](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/OPERATIONS.md#L1017-L1060)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не заявлять заранее сроки восстановления, частоту копирования или отсутствие внешних настроек.
- Рабочие dump/secret values не сохранять в GitHub release assets.

## OPS-14 — Доказать доставку operational alerts ответственному — F03

**Фаза:** F3. **Приоритет:** P1. **Решение:** verification_required. **Очередь:** external_gate. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** F03, ARC19, ARC11. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Readiness helper подтверждает scripts/env/runbook и прямо исключает доказательство live alert routing. Health/heartbeat/progress/queue механизмы существуют; внешняя конфигурация неизвестна.

**Результат.** Принять цепочку сигнал → тревога → получение ответственным → восстановление для включённых зависимостей.

### Область изменений

- `docs/OPERATIONS.md`
- `scripts/observability-evidence-lib.mjs`
- `scripts/check-web-push-worker-queue.mjs`
- `apps/web/src/lib/observability.ts`

### Приёмка

- Назначены реальные owner/channel и применимые thresholds для включённых DB/scanner/workers/queue age/backup/mail и storage capacity.
- Согласованный безопасный отказ/синтетический сигнал достигает человека с правильным объектом; recovery отражается и закрывается.
- Различаются liveness, отсутствие progress, backlog и фактическая внешняя доставка; outbox/heartbeat не считаются получением уведомления.
- Evidence содержит окружение, timestamps и подтверждение получения без секретов.

### Проверки при реализации

- node --test scripts/tests/observability-evidence-lib.node-test.mjs scripts/tests/web-push-worker-health.node-test.mjs scripts/tests/web-push-worker-queue.node-test.mjs
- node --test scripts/tests/observability-live-drill-evidence.node-test.mjs и node scripts/check-observability-live-drill-evidence.mjs — live-drill evidence shape (#191/#262); fixture/validator PASS ≠ закрытие F03/OPS-14.
- pnpm test:focus tests/observability.test.ts
- pnpm observability:ready / pnpm observability:verify проверяют локальный комплект; запись readiness требует предусмотренного ACK и сама не закрывает F03.
- Live routing/drill — только на отдельно согласованном окружении; credentials и существующие settings не читать без допуска.

### Зависимости и условия

OPS-04

Каналы и ответственный — решение владельца; включённые optional mail/push должны совпадать с продуктовой конфигурацией, которую определяют другие треки.

Release applicability: before_live_acceptance.

### Источники

- [scripts/observability-evidence-lib.mjs · 51–110](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/observability-evidence-lib.mjs#L51-L110)
- [scripts/run-observability-readiness.mjs · 11–29](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/run-observability-readiness.mjs#L11-L29)
- [apps/web/src/lib/observability.ts · 1–80](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/observability.ts#L1-L80)
- [scripts/check-resource-release-worker-health.mjs · 7–22](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/check-resource-release-worker-health.mjs#L7-L22)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не подменять live proof набором existsSync/слов в runbook.
- Не объявлять внешнего мониторинга нет только потому, что его нет в repository.

## OPS-15 — Выравнять ограничения worker-контейнеров без изменения доставки

**Фаза:** F1. **Приоритет:** P2. **Решение:** proposal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** license/resource-release workers aligned to push-worker read_only/tmpfs/SIGTERM profile. Structural compose+contract PASS; disposable batch/restart proof still external.

**Исходные пункты:** ARC20, ARC19. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** license/resource-release workers выровнены к push-worker профилю read_only/tmpfs/SIGTERM. Structural compose+contract PASS; disposable batch/restart proof остаётся внешним.

**Результат.** Дать каждой worker-роли минимальные проверенные writable-пути и ресурсы, сохранив batch/retry/shutdown.

### Область изменений

- `compose.production.yaml`
- `compose.mail-worker.yaml`
- `packages/db/scripts/run-resource-release-worker.ts`
- `packages/db/scripts/run-license-maintenance.ts`
- `scripts/check-resource-release-worker-health.mjs`
- `scripts/check-license-worker-health.mjs`
- `scripts/tests/web-push-production-contract.node-test.mjs`
- `scripts/tests/mail-worker-compose.node-test.mjs`

### Приёмка

- License/resource-release используют согласованный hardening профиль с необходимым tmpfs и без записи в код.
- Реальная batch-операция, heartbeat/progress, retry и graceful SIGTERM работают под ограничениями.
- Пределы выбраны по измерению; запрет записи не сломан скрытым runtime path. Бизнес-эффекты не дублируются после restart.

### Проверки при реализации

- node --test scripts/tests/web-push-production-contract.node-test.mjs scripts/tests/mail-worker-compose.node-test.mjs
- pnpm test:focus tests/resource-release-watches-worker.test.ts tests/web-push-worker-maintenance.test.ts
- В существующем disposable production Compose acceptance выполнить фактическую работу каждой изменённой роли и restart/stop; structural tests не являются достаточным доказательством.

### Зависимости и условия

OPS-04

Нет обязательных межтрековых зависимостей для подготовки локального изменения.

Release applicability: when_accepting_selected_worker_runtime_constraints.

### Источники

- [compose.production.yaml · 74–121](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.production.yaml#L74-L121)
- [compose.production.yaml · 141–191](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.production.yaml#L141-L191)
- [compose.mail-worker.yaml · 5–23](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.mail-worker.yaml#L5-L23)
- [packages/db/scripts/run-resource-release-worker.ts · 14–47](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/scripts/run-resource-release-worker.ts#L14-L47)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не распространять read_only на web/DB без анализа их writable-путей.
- Не менять auth/notification semantics и не вводить внешнюю очередь.

## OPS-16 — Опубликовать принятый release bundle и проверить его восстановимую доступность

**Фаза:** F3. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** external_gate. **Исполнение:** not_started. **Область полномочий:** github_settings.

**Исходные пункты:** ARC08, ARC22, OPSNEW-16. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Root подтвердил отсутствие GitHub Releases. CI image/evidence существуют, но не равны опубликованному поддерживаемому релизу.

**Результат.** После явного разрешения создать private GitHub Release/tag с проверенным digest и evidence, доступными в пределах утверждённого retention.

### Область изменений

- `external: GitHub Release/tag/assets and retained release image/evidence bundle`

### Приёмка

- Release/tag указывают exact принятый SHA и полный проверенный bundle; опубликованный image имеет записанный digest/platform.
- Full acceptance завершён для этой версии; artifacts обязательных gates не skipped/missing и проходят строгие validators.
- Consumer с разрешённым read получает именно этот digest и bundle после удаления локального cache; предыдущий необходимый approved image сохранён.
- Release notes описывают изменения/ограничения и migration target; статус deployed не выставлен только из-за публикации.

### Проверки при реализации

- Существующий CI full=true либо v*-tag policy используется только после разрешения запуска/публикации; сопоставить SHA/run attempt и все обязательные jobs.
- Read-only сверить tag commit, Release assets/manifest и GHCR digest; pull-проверка в disposable окружении после допуска.
- Не рассчитывать на release event, созданный GITHUB_TOKEN, как на гарантированный запуск следующего workflow; связать jobs/явный dispatch документированно при реализации.

### Зависимости и условия

OPS-08, OPS-10, OPS-11

Кандидат должен включать принятые межтрековые изменения, которые root внесёт в release scope; эта задача не подтверждает продуктовую полноту сама.

Release applicability: when_approved_release_bundle_is_published.

### Источники

- [.github/workflows/ci.yml · 1–21](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/workflows/ci.yml#L1-L21)
- [.github/workflows/ci.yml · 619–661](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/.github/workflows/ci.yml#L619-L661)
- [GitHub Docs: releases · 19–39](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [GitHub Docs: GITHUB_TOKEN events · 33–45](https://docs.github.com/en/actions/concepts/security/github_token)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Публикация образа/tag/Release — внешняя мутация и требует отдельного допуска.
- Source version/tag, registry digest и deployment receipt — разные идентификаторы; никакого автоматического server rollout.

## OPS-17 — Выполнить отдельно одобренную установку exact digest и записать deployment receipt

**Фаза:** F3. **Приоритет:** P1. **Решение:** accepted_direction. **Очередь:** external_gate. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** ARC08, ARC11, ARC12, ARC13, ARC16. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Immutable runbook уже есть; production host в аудите не инспектировался. Personal Pro не предоставляет required reviewers для private environment.

**Результат.** Установить выбранный оператором готовый image на собственный сервер и подтвердить результат отдельно от CI/Release.

### Область изменений

- `docs/OPERATIONS.md`
- `compose.production.yaml`

### Приёмка

- Оператор явно выбрал digest/manifest; Actions не имеет production deploy credential, на production нет общего self-hosted CI runner.
- Сервер получает private image read-only pull credential; все включённые роли используют approved release без rebuild.
- Выполнены recovery/writer/migration/readiness условия; после ingress подтверждены согласованные HTTPS smoke сценарии.
- Записаны оператор, окружение, время, SHA, digest, schema target, предыдущая версия и исход; failed candidate не становится deployed.
- Возврат выбран согласно schema compatibility; code rollback не объявляется DB rollback.

### Проверки при реализации

- Следовать существующему docs/OPERATIONS.md immutable runbook, исправленному в OPS-12, только после явного live допуска.
- В разрешённом окружении использовать scripts/check-local-readiness.mjs и применимые worker health/queue probes; не запускать disposable CI cleanup на production.
- HTTPS acceptance по утверждённому release scope; live credentials/пользовательские данные не выводить в evidence.

### Зависимости и условия

OPS-12, OPS-13, OPS-14, OPS-16, FLOW-01, FLOW-21, FLOW-22, UX-01, UX-11, UX-13, UX-15, UX-27

Перед открытым пользовательским трафиком должны быть приняты cross-area gates auth/access/download/onboarding и operator-facing/legal тексты; root добавляет конкретные связи. OPS-15/OPS-18 не объявлены универсальными blockers, их роль зависит от утверждённого release scope. Связанный core/security/browser gate включён в общий beta acceptance; принятие следующего SHA подтверждается отдельно. Связанный core/security/browser gate включён в общий beta acceptance; принятие следующего SHA подтверждается отдельно. Связанный core/security/browser gate включён в общий beta acceptance; принятие следующего SHA подтверждается отдельно. Связанный core/security/browser gate включён в общий beta acceptance; принятие следующего SHA подтверждается отдельно. Связанный core/security/browser gate включён в общий beta acceptance; принятие следующего SHA подтверждается отдельно. Связанный core/security/browser gate включён в общий beta acceptance; принятие следующего SHA подтверждается отдельно. Связанный core/security/browser gate включён в общий beta acceptance; принятие следующего SHA подтверждается отдельно. Связанный core/security/browser gate включён в общий beta acceptance; принятие следующего SHA подтверждается отдельно.

Release applicability: when_approved_release_is_deployed_to_target_environment_after_selected_gates.

### Источники

- [docs/OPERATIONS.md · 1062–1086](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/OPERATIONS.md#L1062-L1086)
- [scripts/start-production.sh · 8–16](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/start-production.sh#L8-L16)
- [compose.production.yaml · 34–72](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/compose.production.yaml#L34-L72)
- [GitHub Docs: manual workflow · 35–41](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub Docs: private reviewers · 39–54](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Workflow_dispatch — запуск обладателем write-доступа, не независимый reviewer gate.
- Это ручное решение одного владельца/оператора, если второго человека нет.
- Не считать review package, успешный CI или опубликованный Release разрешением выполнить эту задачу.

## OPS-18 — Измерить single-instance capacity на утверждённом workload

**Фаза:** F3. **Приоритет:** P2. **Решение:** verification_required. **Очередь:** external_gate. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** ARC21. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Проект single-instance; каждый DB client pool max=10, workers имеют собственные процессы; есть process-local directory cache. CI performance regression tests содержательны, но не доказывают capacity площадки.

**Результат.** Получить измеренные пределы latency/очереди/соединений/памяти/storage для выбранной конфигурации без выдуманного SLA.

### Область изменений

- `docs/OPERATIONS.md`
- `docs/PROBLEMS.md`
- `packages/db/src/client.ts`
- `scripts/check-download-network.mjs`
- `apps/web/src/lib/services/mta-master-directory-service.ts`

### Приёмка

- Владелец выбрал реалистичный workload/условия и критерии; evidence содержит actual image, inventory, объём данных и метод измерения.
- Учтён суммарный connection budget web/workers, queue age, RSS, disk/storage read и отказ/восстановление важных зависимостей.
- Результат показывает границу и запас либо конкретный узкий bottleneck; baseline не выдаётся за универсальную нагрузочную гарантию.
- Если нужен рост, сформулирован отдельный follow-up с cache/rolling/migration требованиями, а не автоматически добавлен Redis.

### Проверки при реализации

- Существующий scripts/check-download-network.mjs и browser memory acceptance сохраняются как hosted-CI regression tests, не запускаются на production напрямую.
- Read-only изучить реальные workload/resources только после допуска; затем отдельно согласованный нагрузочный прогон на предназначенной среде.
- Сопоставить max=10 pool per process с числом включённых ролей; это верхняя конфигурационная оценка, не измеренные активные соединения.

### Зависимости и условия

OPS-04, OPS-08

Workload зависит от выбранных бесплатных beta journeys; root связывает с продуктовой приёмкой. Без подтверждённой потребности multi-instance отложен.

Release applicability: before_capacity_commitments_or_expanded_traffic.

### Источники

- [docs/ARCHITECTURE.md · 7–7](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/ARCHITECTURE.md#L7-L7)
- [packages/db/src/client.ts · 7–13](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/client.ts#L7-L13)
- [apps/web/src/lib/services/mta-master-directory-service.ts · 395–414](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/services/mta-master-directory-service.ts#L395-L414)
- [scripts/check-download-network.mjs · 150–200](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/scripts/check-download-network.mjs#L150-L200)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не обещать число пользователей/RPS/RPO или сроки без измерения и решения.
- Не включать horizontal scaling, cache backend или deploymentId автоматически в эту leaf-задачу.

## OPS-19 — Уточнить контракт human resource versions для сравнения обновлений

**Фаза:** F4. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** SemVer-like resource version helpers; strip optional v for storage/compare; fields stay separate; historical IDs not rewritten. validation + build-version-conflict + mta-version-target PASS.

**Исходные пункты:** ARC17. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** SemVer-like resource version helpers strip optional v for storage/compare; build ID/hash stay immutable; historical IDs are not rewritten.

**Результат.** Выбрать канонический формат и сравнение новых resource releases, сохранив старые immutable идентификаторы и MTA compatibility отдельно.

### Область изменений

- `packages/validation/src/index.ts`
- `packages/domain/src`
- `packages/db/src/schema.ts`
- `tests/build-version-conflict.test.ts`
- `tests/mta-version-target.test.ts`
- `tests/validation.test.ts`

### Приёмка

- Выбраны отображение/сравнение новых версий и обработка существующих обозначений; нет скрытой смены смысла опубликованной версии.
- Build identity/hash, app version, mtaVersionTarget и evidence schemaVersion остаются отдельными полями.
- Duplicate version не создаёт новую сборку продукта; prerelease/patch/optional-prefix cases ведут себя согласно выбранному контракту.

### Проверки при реализации

- pnpm test:focus tests/build-version-conflict.test.ts tests/mta-version-target.test.ts tests/validation.test.ts
- Добавить граничные comparison/normalization cases в существующий validation/domain test path; не придумывать новый test filename до реализации.
- Если потребуется SQL, сначала OPS-06 и существующий upgrade rehearsal; без необходимости data migration не создавать.

### Зависимости и условия

Без обязательных task dependencies.

Выбор зависит от продуктового поведения update-center/сравнения версий; UI/INT задачи остаются в другом треке и не дублируются здесь.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/validation/src/index.ts · 261–272](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/validation/src/index.ts#L261-L272)
- [packages/db/src/schema.ts · 409–480](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/schema.ts#L409-L480)
- [packages/db/migrations/0011_build_version_uniqueness.sql · 5–13](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/migrations/0011_build_version_uniqueness.sql#L5-L13)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Не переименовывать задним числом опубликованные build IDs или bytes.
- Не утверждать отсутствие любой нормализации во всех путях; задача уточняет единый контракт.

## OPS-20 — Реализовать private object-storage adapter только при выбранном триггере

**Фаза:** F3. **Приоритет:** P3. **Решение:** existing_goal. **Очередь:** deferred. **Исполнение:** not_started. **Область полномочий:** local_development.

**Исходные пункты:** ARC18. **Решения обсуждения:** NX-002, NX-003, NX-004, NX-011.

**Сейчас.** Local adapter реализован с immutable/integrity/abort checks; configured S3 fail-closed, adapter не установлен. Private object storage/signed delivery обозначены будущей целью.

**Результат.** При подтверждённой необходимости добавить adapter с тем же контрактом и доказуемой миграцией объектов.

### Область изменений

- `packages/storage/src`
- `packages/config/src/index.ts`
- `tests/storage-provider.test.ts`
- `tests/storage-atomic-upload.test.ts`
- `tests/storage-open-file.test.ts`
- `docs/OPERATIONS.md`
- `docs/ARCHITECTURE.md`

### Приёмка

- Владелец выбрал триггер: измеренная ёмкость/доставка либо отдельный коммерческий scope; до этого local остаётся поддерживаемым путём.
- Adapter сохраняет private access, immutable put, size/hash verification, abort и fail-closed; signed delivery не обходит текущую авторизацию/отзыв.
- В disposable окружении пройдены contract cases и migration/restore rehearsal; ошибки не приводят к тихому fallback в local.
- Runtime secret handling и object retention согласованы; ни платежи, ни production DRM не включены этим изменением.

### Проверки при реализации

- pnpm test:focus tests/storage-provider.test.ts tests/storage-atomic-upload.test.ts tests/storage-open-file.test.ts tests/storage-symlink-safety.test.ts
- Добавить реальные adapter contract cases в существующий storage test suite; внешние bucket/credentials require отдельный допуск.
- Миграцию рабочих объектов не выполнять до отдельной принятой репетиции и external_live задачи.

### Зависимости и условия

OPS-05

Может быть перенесено раньше F6 при доказанной бесплатной beta capacity-потребности; решение принимает владелец. Commerce activation и его INT/security gates — другой трек. Conditional infrastructure: перенос из F6 в F3 не делает object storage обязательным для beta и не связывает его с включением коммерции.

Release applicability: only_after_evidence_based_storage_trigger_and_selected_scope.

### Источники

- [packages/storage/src/provider-factory.ts · 7–17](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/storage/src/provider-factory.ts#L7-L17)
- [packages/storage/src/types.ts · 12–29](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/storage/src/types.ts#L12-L29)
- [packages/storage/src/local-provider.ts · 145–217](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/storage/src/local-provider.ts#L145-L217)
- [docs/ARCHITECTURE.md · 44–46](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/ARCHITECTURE.md#L44-L46)

### Ограничения

- Черновик review package: specified не разрешает исполнение; текущие факты и ранее полученный CI PASS не являются приёмкой этой задачи.
- Deferred — не beta blocker и не обещание S3 уже работает.
- Permission local_development допускает только будущую локальную реализацию; production bucket/migration и коммерческая активация отдельно.

## FLOW-01 — Безопасный возврат к исходному действию после входа

**Фаза:** F1. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Safe next return path helper; acquire preserves productId; guest auth links carry next; no auto-mutation after login.

**Исходные пункты:** F01, INT26. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Safe next return path: guest auth links несут next; acquire сохраняет productId; после входа нет auto-mutation. Open Library destination вынесен в UX-27 и исправлен отдельно.

**Результат.** Один безопасный контракт return target для login/register/expired session: вернуть пользователя к тому же object/query/hash, перечитать права и состояние, дать явно завершить действие. Исправить destination «Открыть библиотеку» без большого redesign.

### Область изменений

- `apps/web/src/components/auth-form.tsx`
- `apps/web/src/app/acquire/page.tsx`
- `apps/web/src/components/follow-button.tsx`
- `apps/web/src/components/content-reactions.tsx`
- `apps/web/src/components/content-discussion.tsx`
- `apps/web/src/components/resource-download-button.tsx`
- `apps/web/src/app/market/[slug]/page.tsx`

### Приёмка

- RU/EN guest: ресурс → вход или регистрация → тот же productId → явный claim → библиотека/скачивание; expired session использует тот же recovery.
- Return target допускает только разрешённый внутренний путь; внешний URL/чужой intent отклоняется, смена аккаунта не переносит чужую запись.
- Успешный auth сохраняет document replace; deleted/noaccess после возврата даёт понятное состояние, без автоматической публикации/реакции/скачивания.
- «Открыть библиотеку» ведёт в библиотеку, а не общий dashboard.

### Проверки при реализации

- tests/j5-claim-download-journey.integration.test.ts
- scripts/tests/resource-claim-download.playwright.mjs
- behavior probe: guest login/register, expired cookie, malicious return target, account switch, removed object; проверить final URL и действие, а не только успешный login.

### Зависимости и условия

Без обязательных task dependencies.

Согласовать визуальные entry points с PX09 и гостевыми UI-строками UX-трека. Черновик и неизвестный результат comment-create принадлежат FLOW-10; не заводить второй auth helper.

Release applicability: before_core_beta_acceptance.

### Источники

- [apps/web/src/app/acquire/page.tsx · 83–114](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/acquire/page.tsx#L83-L114)
- [apps/web/src/components/auth-form.tsx · 44–60](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/auth-form.tsx#L44-L60)
- [apps/web/src/app/api/resources/claim/route.ts · 45–48](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/resources/claim/route.ts#L45-L48)
- [apps/web/src/app/market/\[slug\]/page.tsx · 424–447](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L424-L447)
- [apps/web/src/components/follow-button.tsx · 169–172](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/follow-button.tsx#L169-L172)
- [apps/web/src/components/content-reactions.tsx · 128–134](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/content-reactions.tsx#L128-L134)
- [apps/web/src/components/content-discussion.tsx · 245–290](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/content-discussion.tsx#L245-L290)
- [apps/web/src/components/resource-download-button.tsx · 135–141](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-download-button.tsx#L135-L141)
- [apps/web/src/app/workspace/library/\[id\]/versions/page.tsx · 40–55](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/workspace/library/[id]/versions/page.tsx#L40-L55)

### Ограничения

- Не менять модель аутентификации или добровольность 2FA.
- Никакой автоматической мутации после одного лишь входа.
- Подготовленная задача не разрешает GitHub push или production deploy.

## FLOW-02 — Уточнить семантику Follow и сохранения по типу объекта

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Product follow labeled Save (no release-watch promise); detail page wires FollowButton separate from watch; discovery/checking honesty from sibling. Focused discovery-follow + detail acquisition PASS.

**Исходные пункты:** INT01, INT08. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Product follow подписан как Save без обещания release watch; на resource detail FollowButton отделён от watch. User/org/server/content сохраняют разные эффекты; self-follow запрещён.

**Результат.** Назвать текущий product-follow «Сохранить» и вынести на resource detail; для остальных targetType использовать конкретный смысл. Независимое «Следить за ресурсом» допустимо только после определения реальной ленты его событий.

### Область изменений

- `apps/web/src/components/follow-button.tsx`
- `apps/web/src/components/discovery-directory.tsx`
- `apps/web/src/app/market/[slug]/page.tsx`
- `apps/web/src/lib/follow-workspace-copy.ts`
- `packages/db/src/repositories/follow-workspace.ts`
- `packages/db/src/repositories/user-follow-notice.ts`

### Приёмка

- Save не включает release-watch; снятие save не выключает отдельно включённые уведомления.
- Checking/error не изображается как not-following; подтверждённое изменение согласуется между discovery, detail и saved.
- Self-follow и недоступный target объяснены; удаление старой связи работает без раскрытия недоступных metadata.
- Подпись пользователя/организации/сервера/обсуждения не обещает несуществующие события.

### Проверки при реализации

- tests/discovery-follow-http.test.ts
- tests/discovery-follow-persistence.integration.test.ts
- behavior probe: save resource then publish build; проверить независимость watch и saved, и сохранение строгого unknown-state.

### Зависимости и условия

FLOW-01

PX09 отвечает за визуальную иерархию CTA; здесь контракт действия и серверное состояние. Новая resource-event feed требует отдельного decision, не скрытой реализации в rename.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/discovery-directory.tsx · 151–158, 189–221](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/discovery-directory.tsx#L151-L158)
- [apps/web/src/components/follow-button.tsx · 115–203](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/follow-button.tsx#L115-L203)
- [packages/db/src/repositories/follow-workspace.ts · 418–524](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/follow-workspace.ts#L418-L524)
- [apps/web/src/app/market/\[slug\]/page.tsx · 381–450](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L381-L450)
- [apps/web/src/lib/follow-workspace-contract.ts · 1–22](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/follow-workspace-contract.ts#L1-L22)
- [apps/web/src/components/follow-button.tsx · 169–203](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/follow-button.tsx#L169-L203)
- [apps/web/src/components/follow-workspace.tsx · 230–276](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/follow-workspace.tsx#L230-L276)
- [packages/db/src/repositories/user-follow-notice.ts · 19–36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/user-follow-notice.ts#L19-L36)
- [packages/db/src/repositories/publication-notification-delivery.ts · 134–173](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/publication-notification-delivery.ts#L134-L173)

### Ограничения

- Не мигрировать существующие saves в уведомления без явного выбора.
- Не объявлять сохранение ресурса отсутствующим.
- Не начислять очки за follow/unfollow.

## FLOW-03 — Сделать release watch доступным и показывать эффективную доставку

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Public detail release watch with guest return, suppression/settings, access/acquire paths; batch limits honest. Watch http/interaction PASS.

**Исходные пункты:** INT02, INT03, INT04. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Public resource detail отдаёт release watch с guest return, suppression/settings и access/acquire paths; лимиты 100/20 честны; watch не меняет pinned version.

**Результат.** Добавить управление с публичного resource detail; показать причину disabled/suppressed и переход к настройкам. Сохранить future-only, expectedRevision, bounded retry и понятные результаты массового управления.

### Область изменений

- `apps/web/src/app/market/[slug]/page.tsx`
- `apps/web/src/components/resource-release-watch-control.tsx`
- `apps/web/src/components/resource-release-watch-batch-controls.tsx`
- `apps/web/src/lib/resource-release-watches-i18n.ts`
- `packages/db/src/repositories/resource-release-watches.ts`
- `packages/db/src/repositories/resource-release-worker.ts`

### Приёмка

- Имеющий доступ видит одно watch-state на detail и в library; гость возвращается через FLOW-01, без доступа видит шаг получения ресурса.
- При commerceEnabled=false UI показывает suppression; повторное включение не обещает backlog.
- 101-е включение и batch>20 дают конкретный предел; пакетный результат показывает per-item conflict/noaccess/already-on.
- Resume действует только на будущие approved events; stop не меняет сохранение или selected build, неизвестный ответ не объявляется успехом.

### Проверки при реализации

- tests/resource-release-watches-http.test.ts
- tests/resource-release-watch-resume-interaction.test.tsx
- tests/resource-release-watch-batch-repository.test.ts
- behavior probe: category off/on, access loss, no safe build, conflict and unknown response; сверить cursor и отсутствие backfill.

### Зависимости и условия

FLOW-02, FLOW-09

ARC/OPS notification-delivery задачи сохраняют worker guarantees; здесь entry point и effective-state contract. PX09 может задавать placement CTA.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/workspace/library/\[id\]/versions/page.tsx · 125–153](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/workspace/library/[id]/versions/page.tsx#L125-L153)
- [packages/domain/src/resource-release-watches.ts · 1–26](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/domain/src/resource-release-watches.ts#L1-L26)
- [packages/db/src/repositories/resource-release-watches.ts · 96–174](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-release-watches.ts#L96-L174)
- [apps/web/src/components/resource-release-watch-control.tsx · 42–97, 106–160](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-release-watch-control.tsx#L42-L97)
- [packages/db/src/repositories/resource-release-worker.ts · 93–190](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-release-worker.ts#L93-L190)
- [apps/web/src/app/settings/page.tsx · 99–128](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/settings/page.tsx#L99-L128)
- [apps/web/src/lib/resource-release-watches-i18n.ts · 86–97](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/resource-release-watches-i18n.ts#L86-L97)
- [apps/web/src/lib/i18n/ru/admin.ts · 243–250](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/i18n/ru/admin.ts#L243-L250)
- [packages/db/src/repositories/resource-release-watches.ts · 141–174](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-release-watches.ts#L141-L174)
- [apps/web/src/lib/resource-release-watches-i18n.ts · 2–28, 61–70](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/resource-release-watches-i18n.ts#L2-L28)
- [apps/web/src/app/workspace/library/\[id\]/versions/page.tsx · 138–153](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/workspace/library/[id]/versions/page.tsx#L138-L153)

### Ограничения

- Максимумы 100/20 не повышать без отдельного решения.
- Не включать платные покупки или автоматическую установку.
- Не обещать push при недоступном браузерном канале.

## FLOW-04 — Объяснить discussion follow и прямые ответы без ложного mute

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Discussion follow/unfollow copy; no false mute; direct replies preserved. Focused discussion-watch suites PASS.

**Исходные пункты:** INT05. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Discussion follow/unfollow copy явны; unfollow не выдаётся за mute; direct replies сохраняются до object mute (FLOW-05).

**Результат.** Явно обозначить «Следить за обсуждением», причину получения уведомления и точный эффект отписки; сохранить прямые ответы до отдельного решения о mute.

### Область изменений

- `apps/web/src/components/content-discussion.tsx`
- `apps/web/src/components/follow-button.tsx`
- `apps/web/src/lib/follow-workspace-copy.ts`
- `packages/db/src/repositories/notifications.ts`
- `packages/db/src/repositories/follow-workspace.ts`

### Приёмка

- У отписавшегося обычного читателя новые comments не доставляются по снятой связи.
- Автор/parent-author после unfollow получает direct notice, если contentEnabled; UI не обещает полную тишину.
- Следящий автор получает одну запись на comment; сам себе уведомление не создаёт.
- Причина получения и настройки доступны из релевантного UI без раскрытия чужой подписки.

### Проверки при реализации

- tests/discussion-watch-notice.test.ts
- tests/discussion-watch-persistence.integration.test.ts
- behavior probe: following/direct/self matrix with independent followsEnabled/contentEnabled.

### Зависимости и условия

FLOW-09

Object mute — только FLOW-05; resource Q&A — FLOW-12. Не расширять target model обсуждения ресурса в этой задаче.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/content-discussion.tsx · 180–203](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/content-discussion.tsx#L180-L203)
- [packages/db/src/repositories/notifications.ts · 429–475](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/notifications.ts#L429-L475)
- [packages/db/src/repositories/follow-workspace.ts · 172–214, 361–415](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/follow-workspace.ts#L172-L214)
- [apps/web/src/lib/follow-workspace-copy.ts · 62–63](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/follow-workspace-copy.ts#L62-L63)

### Ограничения

- Не превращать unfollow в скрытую глобальную смену preferences.
- Не обещать уведомления по всем прошлым комментариям.

## FLOW-05 — Спроектировать object mute и временную паузу

**Фаза:** F4. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Object mute/snooze (0088); suppresses follow+direct; no backlog; security exempt. Delivery + /api/object-mute + discussion UI. Focused follow/watch suites PASS.

**Исходные пункты:** INT06. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Object-level mute/snooze is on tip (0088 / followWorkspaceService, id prefix omi). Suppresses follow and direct delivery without inventing backlog; security-exempt paths documented.

**Результат.** Принять контракт object mute/snooze: target, срок, приоритет относительно direct/follow/category/channel, судьба событий во время паузы, возобновление и ограничения для security events. После решения реализовать отдельную настройку без удаления сохранённой связи.

### Область изменений

- `packages/db/src/schema.ts`
- `packages/db/src/repositories/notifications.ts`
- `packages/db/src/repositories/resource-release-worker.ts`
- `apps/web/src/components/content-discussion.tsx`
- `apps/web/src/components/notification-inbox.tsx`

### Приёмка

- До реализации есть decision по object scopes, срокам и backlog; отсутствие выбора не подменяется умолчанием в коде.
- Mute discussion подавляет обе причины follow/direct конкретного target, не затрагивая другие объекты.
- Unfollow, stop watch и mute сохраняют независимые состояния; resume не обещает catch-up, если это не утверждено.
- Необходимые security/account notices не зависят от mute произвольного ресурса.

### Проверки при реализации

- behavior probe after decision: direct + followed recipient, mute expiry, category off, deleted target, account switch; доказать независимость связей.
- tests/discussion-watch-notice.test.ts (регрессионная база, не доказательство наличия mute сейчас)

### Зависимости и условия

FLOW-04, FLOW-09

Schema-change требует ARC14/поддерживаемого migration workflow. UX-трек согласует control/copy; эта proposal не является закрытием дефекта unfollow.

- Условно OPS-06: Если выбранная реализация добавляет или изменяет схему БД.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/db/src/schema.ts · 1251–1269, 1308–1323](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/schema.ts#L1251-L1269)
- [packages/db/src/repositories/notifications.ts · 341–390, 450–455](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/notifications.ts#L341-L390)
- [packages/db/src/repositories/resource-release-watches.ts · 141–174](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-release-watches.ts#L141-L174)

### Ограничения

- Новая идея, не объявлять существующим поведением или уже принятой продуктовой политикой.
- Не добавлять бесконечную накопительную очередь на pause по умолчанию.

## FLOW-06 — Спроектировать тихую закладку публикации

**Фаза:** F4. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** follows.notify_comments DEFAULT true; quiet Save vs discussion watch. Existing rows keep notices. Focused follow suites PASS.

**Исходные пункты:** INT07. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Content follow keeps publication in saved with notify_comments default true; quiet Save versus discussion watch are separate actions on tip.

**Результат.** Добавить сохранение публикации без подписки на комментарии, отдельно от discussion follow. До реализации выбрать модель хранения и миграцию прежних content follows без изменения их намерения.

### Область изменений

- `packages/db/src/schema.ts`
- `packages/db/src/repositories/follow-workspace.ts`
- `apps/web/src/components/follow-workspace.tsx`
- `apps/web/src/components/content-discussion.tsx`
- `apps/web/src/lib/follow-workspace-contract.ts`

### Приёмка

- Тихо сохранённая публикация видна владельцу в saved, но чужой comment сам по себе не даёт ей follow-notice.
- Снятие bookmark не отменяет отдельно включённый discussion follow, и наоборот.
- Старые content follows сохраняют прежнюю семантику; миграция не включает и не выключает доставку молча.
- Недоступный target показывает безопасную управляемую заглушку, без закрытых metadata.

### Проверки при реализации

- behavior probe after decision: four bookmark/follow combinations, old-link migration, deleted/private target, pagination and actor isolation.
- tests/saved-follows-page.test.tsx (база существующего saved UI)

### Зависимости и условия

FLOW-02, FLOW-07

Новая модель хранения зависит от ARC14. Saved UI/навигация согласуются с UX-треком; product bookmark заново не строить.

- Условно OPS-06: Если выбранная реализация добавляет или изменяет схему БД.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/db/src/schema.ts · 1251–1269](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/schema.ts#L1251-L1269)
- [packages/db/src/repositories/follow-workspace.ts · 26–39, 71–169](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/follow-workspace.ts#L26-L39)
- [apps/web/src/components/content-discussion.tsx · 180–203](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/content-discussion.tsx#L180-L203)
- [apps/web/src/lib/follow-workspace-copy.ts · 52–63](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/follow-workspace-copy.ts#L52-L63)

### Ограничения

- Proposal до выбора модели/миграции.
- Не дублировать public resource follow в ещё одну одинаковую кнопку.

## FLOW-07 — Согласовать saved workspace и приватные коллекции

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Saved/collections: empty vs filter-empty; Add-to-collection; batch/limit honesty; watch independence. Focused collections/saved suites PASS (integration claimed by agent).

**Исходные пункты:** INT09, INT23. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Saved/collections: empty vs filter-empty, Add-to-collection, batch/limit honesty; watch independence. Недоступные target остаются управляемыми заглушками без закрытых metadata.

**Результат.** Улучшить доступность существующих операций: «В коллекцию» на уместных library surfaces, различимые empty/filter-empty/load-error/unavailable, понятный per-item batch result. Сохранить приватное владение и независимость от notifications.

### Область изменений

- `apps/web/src/components/follow-workspace.tsx`
- `apps/web/src/components/library-collections-screen.tsx`
- `packages/db/src/repositories/follow-workspace.ts`
- `packages/db/src/repositories/library-collection-internals.ts`
- `packages/domain/src/library-collections.ts`

### Приёмка

- Недоступную saved-связь можно удалить, не получая скрытый title/URL.
- Смена фильтра не смешивает курсоры; ошибка чтения не изображается пустым списком.
- Добавление в collection не включает watch; архивирование коллекции не отзывает доступ к ресурсу.
- Лимиты и batch failures показывают конкретный допустимый следующий шаг; повтор подтверждённой команды не дублирует membership.

### Проверки при реализации

- tests/saved-follows-page.test.tsx
- tests/library-collections-persistence.integration.test.ts
- behavior probe: missing target, collection full, partial batch, retry same receipt, import validation.

### Зависимости и условия

FLOW-02

Collection query/history/performance остаются в ARC/OPS scope. Public/shared collections требуют другого решения и здесь не включены.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/db/src/repositories/follow-workspace.ts · 71–169, 428–440](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/follow-workspace.ts#L71-L169)
- [apps/web/src/components/follow-workspace.tsx · 104–130, 178–219, 272–300](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/follow-workspace.tsx#L104-L130)
- [apps/web/src/lib/follow-workspace-contract.ts · 52–58](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/follow-workspace-contract.ts#L52-L58)
- [packages/domain/src/library-collections.ts · 1–46](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/domain/src/library-collections.ts#L1-L46)
- [packages/db/src/repositories/library-collection-internals.ts · 71–79](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/library-collection-internals.ts#L71-L79)
- [apps/web/src/components/library-collections-screen.tsx · 392–457](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/library-collections-screen.tsx#L392-L457)

### Ограничения

- Не повышать лимиты 30/200/20.
- Не превращать private library collections в командный workspace или витрину.

## FLOW-08 — Различить initial loading, empty и подтверждённое прочтение inbox

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Bell loading vs empty after success; mark errors keep confirmed counts; popover≠all-read; page selection≠account-wide; batch>25 blocked. Focused 5 files / 65 tests PASS (docker Node 26).

**Исходные пункты:** INT10, INT11. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Bell различает loading и empty после успеха; ошибки mark сохраняют confirmed counts; popover≠account-wide all-read; page selection≠account-wide; batch>25 блокируется. Переход по ссылке сам не меняет isRead.

**Результат.** Отделить первую загрузку от empty/error, согласовать правило read-on-open/explicit-read и account-wide all-read. Сохранить ожидание серверного подтверждения, конфликтные ревизии, selection scope и корректные counters.

### Область изменений

- `apps/web/src/components/notification-bell.tsx`
- `apps/web/src/components/notification-inbox.tsx`
- `apps/web/src/lib/notification-inbox-contract.ts`
- `apps/web/src/app/api/notifications/inbox/route.ts`
- `packages/db/src/repositories/notifications.ts`

### Приёмка

- Медленное первое чтение показывает loading, настоящий empty — только после успешного ответа.
- Ошибка read/unread не оставляет ложный ноль; stale expectedIsRead приводит к сверке/конфликту.
- Выбрано N на странице отличается от account-wide all-read; batch>25 не отправляется.
- Открытие popover не считается прочтением всех записей; правило перехода по отдельной ссылке едино и явно описано.

### Проверки при реализации

- tests/notification-read.test.ts
- tests/notification-inbox-history-http.test.ts
- behavior probe: first-load latency/error, second-tab read mutation, all-read with more than six notices and unknown response.

### Зависимости и условия

UX-01

UI01 (UX-трек) владеет вкладками, URL state и составом списка. Не исправлять его параллельно вторым локальным фильтром; согласовать общие notification components. Сначала исправляется реальная unread-выдача; loading/read semantics интегрируются поверх её проверенного поведения.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/notification-bell.tsx · 21–62, 73–100, 141–160, 174–207, 242–255](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/notification-bell.tsx#L21-L62)
- [apps/web/src/lib/visible-polling.ts · 1–40](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/visible-polling.ts#L1-L40)
- [apps/web/src/components/notification-inbox.tsx · 146–211](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/notification-inbox.tsx#L146-L211)
- [apps/web/src/lib/notification-inbox-contract.ts · 1–32, 100–151](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/notification-inbox-contract.ts#L1-L32)
- [packages/db/src/repositories/notifications.ts · 176–211](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/notifications.ts#L176-L211)
- [apps/web/src/app/api/notifications/inbox/route.ts · 1–49](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/notifications/inbox/route.ts#L1-L49)
- [packages/security/src/rate-limit-policy.ts · 12–14, 30–32](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/rate-limit-policy.ts#L12-L14)

### Ограничения

- Не строить inbox заново.
- Не изображать provider acceptance как прочтение пользователем.
- Не обходить ограничения batch25/notificationMutation30min.

## FLOW-09 — Разделить категории событий, inbox и Web Push браузера

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Web Push vs inbox/category copy separated; web-push-settings tests PASS.

**Исходные пункты:** INT12. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Web Push отделён от inbox/category copy; explicit permission и состояния unsupported/unconfigured/denied/enabled/error сохранены. Security category не подчиняется object mute.

**Результат.** Сделать effective notification contract понятным: какие события получать, создано ли inbox-сообщение, разрешён ли push текущего браузера. Согласовать resourceActivity/commerce naming и причины недоступности без новых каналов.

### Область изменений

- `apps/web/src/components/web-push-settings.tsx`
- `apps/web/src/app/settings/page.tsx`
- `apps/web/src/lib/i18n/ru/admin.ts`
- `packages/db/src/repositories/notifications.ts`
- `packages/db/src/schema.ts`

### Приёмка

- Первое открытие settings не вызывает browser permission prompt.
- Выключение браузерного push не удаляет inbox и не отключает watch; denied/unconfigured имеют разные recovery instructions.
- Category off объясняется как suppression, без обещания накопленной доставки.
- Включение после расхождения browser/server subscription перечитывает оба состояния и подтверждает фактический результат.

### Проверки при реализации

- tests/web-push-settings.test.ts
- tests/web-push-subscription.integration.test.ts
- behavior probe: browser denied + category on; push off + inbox existing; stale subscription; unconfigured service.

### Зависимости и условия

Без обязательных task dependencies.

Live push-provider/soak acceptance — отдельный OPS gate, не часть локальной UI-задачи. FLOW-03/04 используют этот словарь и effective-state контракт.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/web-push-settings.tsx · 100–152, 156–207, 219–255](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/web-push-settings.tsx#L100-L152)
- [packages/db/src/schema.ts · 1308–1323](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/schema.ts#L1308-L1323)
- [packages/db/src/repositories/notifications.ts · 341–390](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/notifications.ts#L341-L390)

### Ограничения

- Не отправлять реальные push или письма в рамках локального изменения.
- Security category не подчинять произвольному объектному mute.
- Не обещать exactly-once или гарантированное устройство-получение.

## FLOW-10 — Проверить повтор comment-create после потери ответа и закрепить intent protocol

**Фаза:** F1. **Приоритет:** P2. **Решение:** verification_required. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Comment create uses UUIDv4 Idempotency-Key as comments.id; replay/mismatch covered; content-discussion-http + content-comments + form tests PASS.

**Исходные пункты:** INT13. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Guest claim/auth return preserves safe internal next and acquire/productId; expired/external redirects remain regression-covered.

**Результат.** Сначала воспроизвести управляемый lost-response сценарий вне production и зафиксировать результат. Затем определить и реализовать actor-scoped intent/receipt protocol либо иной доказуемый способ сверки; сохранить draft/content/parent context и явную повторную отправку после входа.

### Область изменений

- `apps/web/src/lib/content-comment-client.ts`
- `apps/web/src/components/content-discussion.tsx`
- `apps/web/src/app/api/content/[slug]/comments/route.ts`
- `apps/web/src/lib/services/content-service.ts`
- `packages/db/src/repositories/content-comments.test.ts`
- `packages/db/src/schema.ts`

### Приёмка

- Отдельно записан controlled repro/result; найденный в коде риск не описан как наблюдавшаяся production авария.
- После committed write и потери ответа повтор одного намерения возвращает один comment и один fanout; payload mismatch одного ключа не создаёт вторую запись.
- Новый осознанный intent с тем же текстом допустим: не использовать текстовый dedup вместо identity.
- Guest/401/deleted parent/noaccess сохраняют текст для автора и не публикуют его автоматически после входа.

### Проверки при реализации

- tests/content-discussion-http.test.ts
- packages/db/src/repositories/content-comments.test.ts
- behavior probe: pause response after commit, drop response, resend same intent; отдельно параллельный click, new intent same text и revoke before retry.

### Зависимости и условия

FLOW-01

Новая таблица/unique constraint требует принятого ARC14 migration workflow. Согласовать schema/transaction boundary с OPS/ARC; не выводить success только из появления похожего текста в ленте.

- Условно OPS-06: Если выбранная реализация добавляет или изменяет схему БД.

Release applicability: controlled_retry_verification; schema_fix_depends_on_chosen_design.

### Источники

- [apps/web/src/components/content-discussion.tsx · 145–177, 245–290](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/content-discussion.tsx#L145-L177)
- [apps/web/src/lib/content-comment-client.ts · 10–58](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/content-comment-client.ts#L10-L58)
- [apps/web/src/app/api/content/\[slug\]/comments/route.ts · 68–110](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/content/[slug]/comments/route.ts#L68-L110)
- [apps/web/src/lib/services/content-service.ts · 135–187](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/services/content-service.ts#L135-L187)
- [packages/security/src/rate-limit-policy.ts · 26–28](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/rate-limit-policy.ts#L26-L28)

### Ограничения

- Работа начинается controlled repro/design, не утверждением существующего инцидента.
- Лимиты text2–5000 и commentCreation20/5min сохраняются.
- Только disposable/local test environment, без реальных сообщений.

## FLOW-11 — Сохранить контекст комментариев при edit/delete/search/permalink

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Edit conflict keeps draft+copy; permalink return; delete vs moderation; search keeps draft. Contract/surface tests PASS.

**Исходные пункты:** INT14, INT15. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Edit conflict сохраняет draft+copy; permalink return; delete vs moderation; search сохраняет draft. Reply/search/keyset/exact-comment links и expectedRevision остаются.

**Результат.** Доработать recovery: локальный текст при конфликте, объяснение недоступной permalink-цели, видимый return к общей дискуссии, сохранение draft при поиске и различие удаления/модерации.

### Область изменений

- `apps/web/src/components/content-discussion.tsx`
- `apps/web/src/components/discussion-comment-actions.tsx`
- `packages/db/src/repositories/discussion-management.ts`
- `packages/db/src/repositories/content-discussion.ts`
- `apps/web/src/lib/content-discussion-contract.ts`

### Приёмка

- Старый permalink работает вне первой страницы; удалённый comment не выдаётся за исчезновение доступной публикации.
- Stale revision не перетирает текст; локальный draft можно сравнить/скопировать.
- Удаление parent оставляет children и их ссылки; moderator не получает edit чужого текста.
- Успешное создание/правка остаётся подтверждённым, даже если последующее чтение списка временно не удалось.

### Проверки при реализации

- tests/content-discussion-query.test.ts
- tests/discussion-discovery-persistence.integration.test.ts
- behavior probe: permalink to page>1, deleted parent/target, concurrent edit, search while draft exists, unavailable publication.

### Зависимости и условия

FLOW-10

UI-трек отвечает за визуальную вложенность/controls, здесь права, данные и recovery. Resource Q&A не включается до FLOW-12.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/discussion-comment-actions.tsx · 38–100, 211–219](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/discussion-comment-actions.tsx#L38-L100)
- [packages/db/src/repositories/discussion-management.ts · 90–185](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/discussion-management.ts#L90-L185)
- [apps/web/src/app/api/content/\[slug\]/comments/\[id\]/route.ts · 1–39](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/content/[slug]/comments/[id]/route.ts#L1-L39)
- [packages/security/src/rate-limit-policy.ts · 28–29](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/rate-limit-policy.ts#L28-L29)
- [apps/web/src/components/content-discussion.tsx · 60–102, 128–177, 217–243](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/content-discussion.tsx#L60-L102)
- [packages/db/src/repositories/content-discussion.ts · 40–105](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/content-discussion.ts#L40-L105)
- [packages/db/src/repositories/notifications.ts · 467–475](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/notifications.ts#L467-L475)
- [apps/web/src/lib/content-discussion-contract.ts · 1–55](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/content-discussion-contract.ts#L1-L55)

### Ограничения

- Не заменять существующий discussion module новой независимой моделью.
- Не удалять дочерние ответы вместе с parent.
- Не раскрывать закрытую модераторскую заметку.

## FLOW-12 — Спроектировать Q&A ресурса и версии отдельно от рейтинговых отзывов

**Фаза:** F4. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Separate resource Q&A (not reviews/support); migration 0089; API+panel on detail. Focused 19 PASS. Gaps: follow fanout, abuse/staff removal; migration not applied live.

**Исходные пункты:** INT16. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Publication readiness summary allows FOR SHARE; published build + clean scan identity required for public issue.

**Результат.** Принять target/lifecycle/moderation контракт resource question/thread с необязательным build context, ответом автора и отдельным thread-follow. Затем реализовать без смешивания с rating и private support.

### Область изменений

- `apps/web/src/app/market/[slug]/page.tsx`
- `packages/db/src/repositories/content-discussion.ts`
- `packages/db/src/repositories/follow-workspace.ts`
- `packages/db/src/repositories/resource-reviews.ts`
- `packages/db/src/schema.ts`

### Приёмка

- До разработки определены target identity, visibility, кто может задавать/отвечать/закрывать и что означает resolved.
- Вопрос не создаёт отзыв и не меняет рейтинг; thread-follow не включает все release updates.
- Снятый build не раскрывается для скачивания через thread; private support messages не публикуются.
- Состояния unknown/noauth/noaccess/deleted проверяются тем же command/recovery стандартом, что для публикаций.

### Проверки при реализации

- behavior probe after decision: resource/build visibility transitions, thread follow vs release-watch, question answered/resolved, abuse report and staff removal.

### Зависимости и условия

FLOW-04, FLOW-10, FLOW-11

Требует ARC14 при schema-change и согласованного moderation workload; public Q&A и support не объединять. Review metrics остаются самостоятельными.

- Условно OPS-06: Если выбранная реализация добавляет или изменяет схему БД.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/market/\[slug\]/page.tsx · 346–378](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L346-L378)
- [packages/db/src/repositories/follow-workspace.ts · 26–39](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/follow-workspace.ts#L26-L39)
- [packages/db/src/repositories/content-discussion.ts · 40–65](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/content-discussion.ts#L40-L65)
- [packages/db/src/repositories/resource-reviews.ts · 61–116](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-reviews.ts#L61-L116)

### Ограничения

- Новая идея без обещания retention uplift.
- Не называть отсутствующими существующие article comments или resource reviews.
- Не добавлять reward за количество вопросов.

## FLOW-13 — Сохранить честные состояния реакций и защиту от повторного notification spam

**Фаза:** F2. **Приоритет:** P3. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Reaction unknown/error honesty; guest return; clicks≠points. content-reaction-surface PASS.

**Исходные пункты:** INT17. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Reaction unknown/error honesty и guest return на tip; clicks≠points. Helpful/thanks/insight: одна выбранная реакция, self-reaction запрещён, author notice дедуплицируется.

**Результат.** Завершить доступные подписи, guest return и unknown/error recovery вокруг существующего механизма; зафиксировать, что clicks не равны полезной активности и не создают очки.

### Область изменений

- `apps/web/src/components/content-reactions.tsx`
- `packages/db/src/repositories/content-reactions.ts`
- `packages/db/src/repositories/content-reaction-notice.ts`

### Приёмка

- Один actor не увеличивает одновременно три reactions одной публикации.
- Unknown API state не выглядит как подтверждённые нули; failure не меняет счётчик оптимистично.
- Remove/re-add не порождает повторный spam автору; self-reaction отвергается сервером.
- После login пользователь явно выбирает реакцию, без автоматической записи.

### Проверки при реализации

- tests/content-reaction-notice.test.ts
- tests/content-reaction-persistence.integration.test.ts
- behavior probe: change/remove/readd, author self, timeout and guest return.

### Зависимости и условия

FLOW-01

Репутация/очки/retention metrics — отдельное решение. UI может переиспользовать общий control standard без изменения данных reactions.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/content-reactions.tsx · 1–135](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/content-reactions.tsx#L1-L135)
- [packages/db/src/repositories/content-reactions.ts · 152–210](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/content-reactions.ts#L152-L210)
- [packages/db/src/repositories/content-reaction-notice.ts · 16–34](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/content-reaction-notice.ts#L16-L34)
- [packages/security/src/rate-limit-policy.ts · 27–30](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/rate-limit-policy.ts#L27-L30)

### Ограничения

- Не добавлять новые reaction types или leaderboard в эту задачу.
- Лимит 30 изменений/мин сохраняется.

## FLOW-14 — Сохранять поисковый контекст и честные data states

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Search preserves URL context; failure returns 503 without empty payload; discovery-search-behavior PASS.

**Исходные пункты:** INT18. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Search/discovery сохраняют URL context; failure возвращает 503 без empty payload; filters/keyset/error≠empty. Follow-state может быть unknown.

**Результат.** Согласовать Back/refresh/filter reset и recovery на переходе из результата в объект; сделать активные фильтры и scope поиска явными, сохраняя unknown состояния связанных действий.

### Область изменений

- `apps/web/src/components/discovery-directory.tsx`
- `apps/web/src/app/discover/page.tsx`
- `apps/web/src/app/api/search/route.ts`
- `apps/web/src/lib/services/discovery-service.ts`

### Приёмка

- Back восстанавливает query/type/фильтры; смена фильтра сбрасывает несовместимый cursor.
- 503/429 не отображаются как «Ничего не найдено»; повтор управляемый, без бесконечного polling.
- Неудачное чтение follow не превращает saved в not-saved.
- Ссылка с поисковым состоянием воспроизводима; q≤100 и серверный scope соблюдаются.

### Проверки при реализации

- tests/discovery-search-behavior.test.ts
- tests/discovery-follow-http.test.ts
- behavior probe: deep result → object → Back, changing filters on later cursor, service failure and rate limit.

### Зависимости и условия

Без обязательных task dependencies.

UX-трек владеет layout/filter controls; ARC — query/index/performance. Не переписывать pagination engine ради формы.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/discovery-directory.tsx · 25–75, 125–180, 212–221](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/discovery-directory.tsx#L25-L75)
- [apps/web/src/app/discover/page.tsx · 49–96](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/discover/page.tsx#L49-L96)
- [apps/web/src/app/api/search/route.ts · 1–126](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/search/route.ts#L1-L126)
- [packages/security/src/rate-limit-policy.ts · 30–32](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/rate-limit-policy.ts#L30-L32)

### Ограничения

- Не добавлять непрослеживаемую персонализацию ранжирования.
- Не обещать public search по закрытым объектам.

## FLOW-15 — Объяснить границы profile privacy и публичный просмотр

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Privacy scope copy; guest preview; conflict keeps local toggles. profile-privacy + users page PASS.

**Исходные пункты:** INT19. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Privacy scope copy и guest preview; conflict сохраняет local toggles. showActivity/showProfessionalContacts с expectedUpdatedAt; это не full private account или block user.

**Результат.** Уточнить scope двух настроек и дать безопасный просмотр публичного профиля от лица гостя; сохранять форму при конфликте и не обещать скрытие публичных ресурсов целиком.

### Область изменений

- `apps/web/src/components/profile-privacy-editor.tsx`
- `packages/db/src/repositories/profile-privacy.ts`
- `packages/db/src/repositories/developer-profile.ts`
- `apps/web/src/app/users/[username]/page.tsx`

### Приёмка

- Выключенные contacts отсутствуют в public data, не только CSS.
- Preview показывает разрешённый guest-view без owner-only metadata.
- Изменение privacy конфликтует по expectedUpdatedAt без потери локального выбора.
- Текст явно говорит, что public authored content/resources не исчезают автоматически.

### Проверки при реализации

- tests/profile-privacy-http.test.ts
- tests/profile-privacy-persistence.integration.test.ts
- behavior probe: two-tab edit, owner→guest preview, hidden contact in page payload.

### Зависимости и условия

Без обязательных task dependencies.

Account lifecycle/blocking из других треков — отдельные goals; не расширять этот toggle их смыслом. UX согласует preview placement.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/profile-privacy-editor.tsx · 1–145](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/profile-privacy-editor.tsx#L1-L145)
- [packages/db/src/repositories/profile-privacy.ts · 6–8, 41–78](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/profile-privacy.ts#L6-L8)
- [packages/db/src/repositories/developer-profile.ts · 20–30](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/developer-profile.ts#L20-L30)
- [apps/web/src/app/users/\[username\]/page.tsx · 116–124](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/users/[username]/page.tsx#L116-L124)

### Ограничения

- Не вводить private account без отдельного решения.
- Не трактовать display default=true как согласие на новый контактный канал.

## FLOW-16 — Дать честный MTA connect intent и fallback копирования адреса

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Connect/Copy honesty on server surfaces; server-card tests PASS.

**Исходные пункты:** INT20. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Connect/Copy honesty на server surfaces: mtasa:// назван как intent, copy IP:port с ручным fallback; browser не получает подтверждение фактического входа. Unknown/stale observations честны.

**Результат.** Назвать действие «Открыть в MTA», добавить copy IP:port с ручным fallback и честным результатом попытки; не превращать launch click в доказательство посещения.

### Область изменений

- `apps/web/src/app/servers/[slug]/page.tsx`
- `apps/web/src/components/mta-master-server-directory.tsx`
- `packages/db/src/repositories/follow-workspace.ts`

### Приёмка

- Clipboard success показан только после успешного write; отказ оставляет выделяемый адрес.
- Protocol click не создаёт verified-play marker и не допускает отзыв как после подтверждённой игровой сессии.
- Private/deleted server не раскрывает старый endpoint через saved entry.
- Устаревшее наблюдение явно обозначено; unknown online не заменяется новым выдуманным нулём.

### Проверки при реализации

- behavior probe: unsupported protocol, clipboard denied, manual copy, stale/unknown observation, server visibility change.

### Зависимости и условия

Без обязательных task dependencies.

UX/PX связывают directory с NEXUS profile; F06 исправляет отдельный Home unknown→0. Здесь только detail connect/fallback семантика.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/servers/\[slug\]/page.tsx · 108–116, 193–199, 320–323](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/servers/[slug]/page.tsx#L108-L116)
- [packages/db/src/repositories/follow-workspace.ts · 112–119](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/follow-workspace.ts#L112-L119)

### Ограничения

- Не пытаться доказать запуск внешнего MTA по таймеру/blur.
- Не учитывать этот клик как проверенное использование сервера.

## FLOW-17 — Явно показывать версию скачивания и подтверждённую передачу файла

**Фаза:** F2. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Download labels latest vs selected; confirmed handoff only; integrity distinct. download-button + detail acquisition PASS. Tip session-actor binding wave (6cefa74e) does not change download handoff labels; F08 barrier probe still open.

**Исходные пункты:** INT21, INT22. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Download различает latest vs selected; confirmed handoff only; integrity отдельно. Session-actor binding wave не меняет handoff labels; F08 barrier probe остаётся открытым.

**Результат.** Различать «скачать последнюю» и «скачать выбранную», сохранять явный выбор при unavailable fixed build; показывать только подтверждённый handoff с переходом к квитанции/инструкции/контекстному support.

### Область изменений

- `apps/web/src/components/resource-download-button.tsx`
- `apps/web/src/app/market/[slug]/page.tsx`
- `apps/web/src/app/workspace/library/[id]/versions/page.tsx`
- `apps/web/src/app/api/products/[id]/download/route.ts`
- `packages/db/src/repositories/resource-library-selections.ts`

### Приёмка

- При fixed=v1/latest=v2 до клика ясно, какой build будет запрошен в каждой точке входа.
- Новый release/watch не меняет fixed selection; недоступный fixed не заменяется latest молча.
- Cancel, noaccess, unavailable build, integrity error и success handoff различаются; файл не объявляется установленным.
- Квитанция относится к фактическому build/выдаче; session return не запускает download автоматически.

### Проверки при реализации

- apps/web/src/components/resource-download-button.test.tsx
- tests/resource-download-route.integration.test.ts
- tests/resource-release-control-interaction.test.tsx
- behavior probe: pinned old build plus new release, quarantine selected build, cancel before handoff and integrity failure.

### Зависимости и условия

FLOW-01, FLOW-21

PX09 отвечает за визуальную hierarchy/version CTA; support linkage согласуется с FLOW-19. Не менять established artifact verification protocol без ARC review.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/resource-download-button.tsx · 48–100, 115–157](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-download-button.tsx#L48-L100)
- [apps/web/src/app/api/products/\[id\]/download/route.ts · 65–115](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/products/[id]/download/route.ts#L65-L115)
- [packages/security/src/rate-limit-policy.ts · 7–8](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/rate-limit-policy.ts#L7-L8)
- [apps/web/src/app/market/\[slug\]/page.tsx · 391–430](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L391-L430)
- [apps/web/src/app/workspace/library/\[id\]/versions/page.tsx · 62–93, 125–153](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/workspace/library/[id]/versions/page.tsx#L62-L93)
- [apps/web/src/app/api/products/\[id\]/download/route.ts · 99–115](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/products/[id]/download/route.ts#L99-L115)
- [packages/db/src/repositories/resource-library-selections.ts · 99–158](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-library-selections.ts#L99-L158)

### Ограничения

- Не обещать отзыв уже полученных пользователем bytes.
- Не считать handoff доказательством записи на диск/установки.
- Не подменять selected version автоматически.

## FLOW-18 — Показывать точную eligibility отзывов без выдуманного verified-use

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Exact review eligibility reason codes; no fake verified-use; refresh after Follow. review pages/panel PASS.

**Исходные пункты:** INT24, INT25. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Exact review eligibility reason codes; access/follow не выдаются за verified-use; refresh после Follow. Removed и withdrawn различны.

**Результат.** Показывать допустимые reason codes и следующие шаги; после Follow перечитывать review eligibility. Сохранить lifecycle/revision rules и честную подпись основания отзыва.

### Область изменений

- `apps/web/src/components/resource-review-controls.tsx`
- `apps/web/src/components/server-review-panel.tsx`
- `packages/db/src/repositories/resource-reviews.ts`
- `packages/db/src/repositories/server-reviews.ts`
- `apps/web/src/app/market/[slug]/page.tsx`

### Приёмка

- Owner/manager conflict объяснён до отправки, сервер всё равно проверяет его повторно.
- Access/follow, утраченные между read и write, не позволяют записать отзыв; текст доступен для копирования.
- Removed не переиздаётся как withdrawn; stale revision не перетирает новую версию.
- Follow/entitlement маркируются как соответствующие основания, без обещания verified gameplay/install.

### Проверки при реализации

- tests/resource-review-http.test.ts
- tests/server-review-http.test.ts
- tests/resource-review-lifecycle.integration.test.ts
- behavior probe: role/ownership conflict, follow toggled in another tab, archived resource, removed review and reused revision.

### Зависимости и условия

FLOW-02

UX controls и F06 error-vs-empty не дублировать в параллельном server-review-panel edit. Реальная verified-use модель — отдельный decision.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/db/src/repositories/resource-reviews.ts · 61–116](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-reviews.ts#L61-L116)
- [apps/web/src/components/resource-review-controls.tsx · 91–128](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-review-controls.tsx#L91-L128)
- [apps/web/src/app/market/\[slug\]/page.tsx · 346–378](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L346-L378)
- [packages/security/src/rate-limit-policy.ts · 29–30](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/rate-limit-policy.ts#L29-L30)
- [packages/db/src/repositories/server-reviews.ts · 48–111, 158–189, 238–297](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/server-reviews.ts#L48-L111)
- [apps/web/src/components/server-review-panel.tsx · 147–198](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/server-review-panel.tsx#L147-L198)

### Ограничения

- Rating1–5 и resource text3–4000 сохраняются.
- Не привязывать право отзыва к mtasa click или скачиванию без утверждённой модели.
- Не начислять reward за отзывы.

## FLOW-19 — Добавить объектный контекст к устойчивому support flow

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Support create attaches verified product/build/receipt context; closed→related path; idempotency preserved. support route/validation PASS.

**Исходные пункты:** INT27. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Support create присоединяет verified product/build/receipt context; closed→related path; idempotency/status/revision guards сохранены. Private requester/staff model без второго тикетного движка.

**Результат.** Дать контекстные входы resource/build/download receipt, показать приложенный контекст перед отправкой и проверить связь сервером. Сохранить intent при unknown response и честный путь для closed кейса.

### Область изменений

- `apps/web/src/components/support-center.tsx`
- `apps/web/src/components/support-case-thread.tsx`
- `apps/web/src/components/support-case-actions.tsx`
- `packages/db/src/repositories/support.ts`
- `packages/db/src/repositories/support-access.ts`
- `packages/validation/src/index.ts`

### Приёмка

- Контекст с object/build/receipt принадлежит доступной actor ситуации и не подменяется клиентом.
- Повтор того же create/reply не дублирует запись; 409 перечитывает status, текст не теряется.
- Requester не читает чужой case и не открывает closed; resolved reply осознанно возвращает open.
- Closed предлагает разрешённый дальнейший путь/новый связанный кейс; private message не уходит в public Q&A/notification preview целиком.

### Проверки при реализации

- tests/support-mutation-idempotency.integration.test.ts
- tests/support-command-session.integration.test.ts
- behavior probe: receipt-linked case, tampered context, response lost after commit, concurrent close and reply.

### Зависимости и условия

FLOW-01

Shared idempotency patterns могут помочь FLOW-10, но не переносить support schema механически. Commerce disputes/payment cases вне free-beta scope.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/support-center.tsx · 140–162](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/support-center.tsx#L140-L162)
- [apps/web/src/components/support-case-thread.tsx · 120–202, 425–455](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/support-case-thread.tsx#L120-L202)
- [apps/web/src/components/support-case-actions.tsx · 20–38](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/support-case-actions.tsx#L20-L38)
- [packages/db/src/repositories/support.ts · 265–296, 374–420, 612–650](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/support.ts#L265-L296)
- [packages/security/src/rate-limit-policy.ts · 31–32](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/rate-limit-policy.ts#L31-L32)
- [packages/validation/src/index.ts · 363–387](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/validation/src/index.ts#L363-L387)

### Ограничения

- Не строить второй чат/тикетный движок.
- Лимиты new5/hour, reply30/hour и text lengths сохраняются.
- Не отправлять реальные сообщения staff в разработческой проверке.

## FLOW-20 — Показывать author/admin lifecycle как разрешённые переходы

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Lifecycle UI allowed transitions; restore/release→draft not auto-publish; unavailable build→support. release-control repo/interaction PASS. Tip FLOW-22 HTTP fresh-auth + session-actor binding (6cefa74e) remain separate from lifecycle transition UI.

**Исходные пункты:** INT28. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Lifecycle UI показывает разрешённые переходы; restore archived / release suspended → draft, не auto-publish; unavailable build → support. FLOW-22 fresh-auth остаётся отдельным staff gate.

**Результат.** Свести в workspace ресурс, выбранную сборку и следующий разрешённый шаг; различать archive/suspend/build unavailable и показывать корректный support path, без обещания auto-publication.

### Область изменений

- `apps/web/src/components/resource-lifecycle-controls.tsx`
- `apps/web/src/components/resource-moderation-controls.tsx`
- `packages/domain/src/resource-commerce.ts`
- `packages/domain/src/resource-release-control.ts`
- `packages/db/src/repositories/product-lifecycle.ts`
- `packages/db/src/repositories/builds-lifecycle.ts`

### Приёмка

- Кнопка выводится по текущему actor/status, а сервер повторно проверяет права и expected revision.
- Restore/release показывает draft и следующий review step, не «снова опубликовано».
- При конфликте перечитывается состояние; старое намерение не применяется молча к другому status/build.
- Unavailable resource блокирует download/review/new watch, но разрешённое снятие своей связи доступно.

### Проверки при реализации

- tests/resource-release-control-repository.test.ts
- tests/resource-release-control-interaction.test.tsx
- behavior probe: archive→restore, suspend→release, build quarantine, role revoked while confirmation open.

### Зависимости и условия

FLOW-22

ARC/OPS lifecycle state machines остаются источником истины; UX status badges строятся из них. Не создавать новую независимую publish flag.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/domain/src/resource-commerce.ts · 19–29](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/domain/src/resource-commerce.ts#L19-L29)
- [packages/domain/src/resource-release-control.ts · 3–39](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/domain/src/resource-release-control.ts#L3-L39)
- [apps/web/src/components/resource-lifecycle-controls.tsx · 32–65](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-lifecycle-controls.tsx#L32-L65)
- [apps/web/src/components/resource-moderation-controls.tsx · 33–90](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-moderation-controls.tsx#L33-L90)
- [packages/db/src/repositories/resource-release-watches.ts · 119–131](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-release-watches.ts#L119-L131)

### Ограничения

- Не расширять полномочия moderator из-за нового UI.
- Не раскрывать закрытые staff notes в публичной причине.
- Не включать платную продажу при публикации ресурса.

## FLOW-21 — Проверять initiating session в финальных upload/download gates

**Фаза:** F1. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Final upload/download gates lock initiating session token before build/receipt writes; focused auth tests PASS (docker Node 26). Tip session-actor binding wave (6cefa74e) reinforces actor/session honesty on related mutations; F08 controlled multi-connection barrier probe on disposable DB remains open.

**Исходные пункты:** F08. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Final upload/download authorization locks the initiating session token before build/receipt writes. HTTP/code lock is on tip; a controlled multi-connection barrier probe on disposable/live DB remains open (see PROBLEMS F08).

**Результат.** Провести initiating token до final transaction и применить existing lockInitiatingSession с согласованным lock order; добавить контролируемую проверку revoke/expiry между initial auth и final gate.

### Область изменений

- `apps/web/src/app/api/products/[id]/builds/route.ts`
- `apps/web/src/app/api/products/[id]/download/route.ts`
- `apps/web/src/lib/services/product-service.ts`
- `packages/db/src/repositories/builds-moderation.ts`
- `packages/db/src/repositories/resource-download-authorization.ts`
- `packages/db/src/repositories/initiating-session.ts`

### Приёмка

- Барьер до final gate → revoke initiating session → resume даёт отказ без new build/receipt/download_started и начала выдачи.
- Expiry, включая истечение во время ожидания lock, отказывает; другая живая сессия actor не заменяет исходную.
- Current ownership/entitlement/build checks и cleanup не ослаблены; valid request проходит прежний безопасный путь.
- Документация ограничивает гарантию моментом final authorization, не обещая вернуть уже отправленные bytes.

### Проверки при реализации

- tests/build-upload-recovery-authorization.test.ts
- tests/resource-download-authorization.test.ts
- tests/resource-download-http.integration.test.ts
- behavior probe: disposable DB barrier before final gate, revoke/expiry from second connection, resume with same initiating token; existing tests не считаются доказательством этого race до расширения.

### Зависимости и условия

Без обязательных task dependencies.

Lock ordering и transaction invariants согласовать с ARC-задачами. Это средний ограниченный gap; не переименовывать его в доказанный unauthenticated bypass.

Release applicability: controlled_security_verification_before_beta.

### Источники

- [apps/web/src/app/api/products/\[id\]/builds/route.ts · 201–298](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/products/[id]/builds/route.ts#L201-L298)
- [apps/web/src/app/api/products/\[id\]/download/route.ts · 133–152](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/products/[id]/download/route.ts#L133-L152)
- [packages/db/src/repositories/resource-download-authorization.ts · 11–81](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/resource-download-authorization.ts#L11-L81)
- [packages/db/src/repositories/initiating-session.ts · 7–27](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/initiating-session.ts#L7-L27)
- [packages/db/src/repositories/builds-moderation.ts · 25–72](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/db/src/repositories/builds-moderation.ts#L25-L72)

### Ограничения

- Не выполнять конкурентный эксперимент на production.
- Не отключать scan/hash/build-current checks ради session lock.
- Не считать истечение после уже начатой передачи обещанием отзыва bytes.

## FLOW-22 — Применить свежую аутентификацию к критичным staff-действиям

**Фаза:** F1. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** admin/actions requires current_password for all critical staff actions; build approve/reject recheck hash in txn. Tip HTTP enforcement covered by admin-actions-fresh-auth-http; session-actor binding wave (6cefa74e) binds related staff/mutation paths to initiating/displayed session. Fresh password ≠ mandatory 2FA.

**Исходные пункты:** F09. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Admin/actions HTTP requires fresh current-password proof for critical staff actions per fresh-auth-policy; foreign/revoked session and role loss are rejected. Compromised-session absence is not claimed.

**Результат.** Применить уже действующее правило staff_action→current_password к существующим критичным admin/actions минимальным серверным подтверждением текущего пароля; связать проверку с текущими actor/session и финальной транзакцией. Отдельный TTL/capability-token сервис для этого исправления не обязателен.

### Область изменений

- `packages/security/src/fresh-auth-policy.ts`
- `apps/web/src/app/api/admin/actions/route.ts`
- `apps/web/src/lib/services/auth-service.ts`
- `apps/web/src/lib/services/product-service.ts`
- `packages/db/src/repositories/builds-moderation.ts`
- `tests/fresh-auth-policy.test.ts`

### Приёмка

- Инвентаризация существующих critical admin actions привязана к действующей staff_action policy; HTTP handler действительно проверяет current_password, а не только сессию/роль.
- Без подтверждения, с неверным паролем либо чужой session критичная команда отвергается; действующий пароль плюс current role/session/revision проходит.
- Смена пароля, отзыв сессии или утрата роли между проверкой и финальной транзакцией не позволяют применить устаревшее подтверждение; использован согласованный existing transaction guard.
- Пароль не попадает в logs/audit. Прямое подтверждение текущим паролем не блокируется ожиданием нового TTL/proof-token решения.

### Проверки при реализации

- tests/fresh-auth-policy.test.ts
- behavior probe: real admin/actions critical command with absent/wrong/valid current password, foreign session, role/session revocation and password change before final transaction; проверить реальный HTTP→repository enforcement.

### Зависимости и условия

Без обязательных task dependencies.

Текущая staff_action→current_password policy достаточна для минимального исправления. Расширение на новые endpoints, отдельный capability-token/TTL сервис и неописанный passwordless staff path — открытый scope отдельной задачи, не prerequisite основного enforcement. Optional 2FA остаётся добровольной.

Release applicability: existing_staff_policy_enforcement_before_beta.

### Источники

- [packages/security/src/fresh-auth-policy.ts · 1](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/security/src/fresh-auth-policy.ts#L1)
- [apps/web/src/app/api/admin/actions/route.ts · 28–98](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/api/admin/actions/route.ts#L28-L98)
- [tests/fresh-auth-policy.test.ts · 1](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/tests/fresh-auth-policy.test.ts#L1)
- [apps/web/src/lib/services/auth-service.ts · 1](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/services/auth-service.ts#L1)

### Ограничения

- Fresh current-password confirmation не равно обязательной 2FA.
- Не заявлять обнаруженный захват аккаунта или общий RBAC bypass.
- Не вводить новый proof-token сервис или ждать владельца по обратимой детали реализации, если прямое подтверждение текущим паролем реализует действующую policy.

## UX-01 — Вкладка непрочитанных меняет реальную выдачу

**Фаза:** F2. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Unread/All/Read are URL links driving inbox state; cursor cleared; surface tests 10/10.

**Исходные пункты:** UI01, UI16. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Unread/All/Read — URL links, задающие inbox state; смена state сбрасывает cursor; surface tests покрывают выдачу. Общий Tabs primitive не обязателен для этого контракта.

**Результат.** Синхронизировать All/Unread, URL и показанный список, сохранив доступность и корректную семантику route navigation.

### Область изменений

- `apps/web/src/components/notification-center-tabs.tsx`
- `apps/web/src/app/notifications/page.tsx`
- `packages/ui/src/tabs.tsx`

### Приёмка

- Unread реально исключает прочитанные; All возвращает оба вида. Direct link, refresh и Back восстанавливают тот же выбор.
- Смена state сбрасывает cursor, сохраняя независимые фильтры. Выделение не расходится с state=read.
- Для локальных tabs есть roving focus/tabpanel relation; route navigation остаётся ссылками. Минимальный фикс не ждёт полного refactor Tabs.

### Проверки при реализации

- tests/notification-inbox-history-surface.test.tsx.
- scripts/tests/shell-accessibility.playwright.mjs: добавить утверждение состава списка, а не только aria-selected.

### Зависимости и условия

Без обязательных task dependencies.

Mutation read/unread, counters, batches и доставка определяются docs/FLOWS.md; здесь только UI state/URL/list.

Release applicability: before_core_beta_acceptance.

### Источники

- [apps/web/src/components/notification-center-tabs.tsx · L7-L55](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/notification-center-tabs.tsx#L7-L55)
- [apps/web/src/app/notifications/page.tsx · L39-L50](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/notifications/page.tsx#L39-L50)
- [packages/ui/src/tabs.tsx · L18-L69](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/tabs.tsx#L18-L69)
- [apps/web/src/components/notification-center-tabs.tsx · L17-L55](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/notification-center-tabs.tsx#L17-L55)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не создавать вторую семантику inbox и не выдавать code inspection за выполненный browser PASS.

## UX-02 — Единое оформление действий без потери native семантики

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Button/native action semantics + design-token contrast PASS.

**Исходные пункты:** UI02, UI03, UI10. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Button уже native button с focus/busy/disabled; Link CTA и карточки оформляются отдельно. Header controls имеют неодинаковые размеры.

**Результат.** Согласовать Button, ссылку CTA и card link, сохранив семантику перехода и действия.

### Область изменений

- `packages/ui/src/button.tsx`
- `packages/ui/src/index.ts`
- `apps/web/src/components/account-controls.tsx`
- `apps/web/src/components/product-card.tsx`
- `apps/web/src/components/server-card.tsx`
- `apps/web/src/components/locale-switcher.tsx`
- `apps/web/src/components/theme-toggle.tsx`
- `apps/web/src/app/page.tsx`

### Приёмка

- Link и Button одного варианта совпадают по геометрии и focus treatment; особый hero-вариант объявлен явно.
- Anchor сохраняет href, Ctrl/Cmd-click и копирование адреса; нет вложенных button/anchor.
- Карточка имеет видимый keyboard focus; быстрые действия при необходимости находятся вне anchor.
- Compact/touch размеры заданы явно; предлагаемая цель около 44 px для важных touch actions проверена на 320/390 px.

### Проверки при реализации

- tests/design-token-contrast.test.ts.
- scripts/tests/shell-accessibility.playwright.mjs: существующие focus и target-size проверки.
- Поведенческая проверка Tab/Enter/Ctrl-click и рядом расположенных touch actions в RU/EN, light/dark.

### Зависимости и условия

Без обязательных task dependencies.



Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/ui/src/button.tsx · L4-L49](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/button.tsx#L4-L49)
- [apps/web/src/app/page.tsx · L58-L70](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/page.tsx#L58-L70)
- [apps/web/src/components/product-card.tsx · L15-L19](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/product-card.tsx#L15-L19)
- [apps/web/src/components/product-card.tsx · L49-L70](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/product-card.tsx#L49-L70)
- [packages/ui/src/button.tsx · L27-L31](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/button.tsx#L27-L31)
- [apps/web/src/components/theme-toggle.tsx · L67-L77](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/theme-toggle.tsx#L67-L77)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- 24/32 px не объявляются автоматическим WCAG failure. Не менять глобально default type Button без проверки submit-потребителей.
- Независимый global-error остаётся разумным исключением.

## UX-03 — Единые поля с подписями ошибками и явными состояниями

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Field/Input aria-describedby hint/error; disabled/readOnly/pending chrome. ui-accessibility + server-details-form-fields PASS.

**Исходные пункты:** UI05, UI06, UI09. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Input имеет label/error wiring, fieldClass оформляет native fields; серверная форма и сравнение коллекций используют дополнительные локальные рецепты.

**Результат.** Общий control chrome и Field label/hint/error для input/select/textarea, включая disabled/readOnly.

### Область изменений

- `packages/ui/src/input.tsx`
- `packages/ui/src/field-classes.ts`
- `packages/ui/src/index.ts`
- `apps/web/src/components/server-details-form.tsx`
- `apps/web/src/components/community-topic-form.tsx`
- `apps/web/src/app/workspace/library/collections/[id]/compare/page.tsx`

### Приёмка

- Label/hint/error связаны через id и aria-describedby; invalid не обозначен только цветом.
- Одинаковые размеры имеют согласованные radius/focus/spacing; compact вариант явный.
- Disabled, readOnly, pending и отсутствие выбора различимы; readOnly можно скопировать, причина недоступности видна без hover.
- Сохранены type/name/required/min/maxLength, GET filters и системный mobile select.

### Проверки при реализации

- tests/ui-accessibility.test.tsx.
- tests/server-details-form-fields.test.tsx.
- Поведенческая проверка invalid/retry/readOnly/disabled в RU/EN и 320 px.

### Зависимости и условия

Без обязательных task dependencies.



Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/ui/src/input.tsx · L29-L53](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/input.tsx#L29-L53)
- [packages/ui/src/field-classes.ts · L1-L9](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/field-classes.ts#L1-L9)
- [packages/ui/src/input.tsx · L23-L53](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/input.tsx#L23-L53)
- [packages/ui/src/index.ts · L1-L14](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/index.ts#L1-L14)
- [packages/ui/src/button.tsx · L15-L16](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/button.tsx#L15-L16)
- [packages/ui/src/button.tsx · L35-L46](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/button.tsx#L35-L46)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не заменять native select combobox без конкретной потребности поиска.
- Raw input включает checkbox/file/hidden; это не список неоформленных текстовых полей.

## UX-04 — Сохранять редактируемую работу и честно показывать отправку

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Community/server forms lock while pending; keep input on error; localized confirmed/error. Focused form/a11y PASS.

**Исходные пункты:** UI07, UI08, UI23. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Community/server forms блокируют поля при pending, сохраняют input при error и показывают localized confirmed/error. FollowButton по-прежнему различает checking/error/success.

**Результат.** Не терять поздние правки и показывать локализованный pending/error/confirmed result.

### Область изменений

- `apps/web/src/components/community-topic-form.tsx`
- `apps/web/src/components/server-details-form.tsx`
- `apps/web/src/components/follow-button.tsx`
- `packages/ui/src/input.tsx`
- `packages/ui/src/button.tsx`

### Приёмка

- При задержке либо поля временно заблокированы, либо новые правки сохраняются отдельно; отправленная редакция однозначна.
- Ошибка оставляет введённое и допускает исправление; повтор не создаёт вторую одновременную команду.
- API code даёт понятную RU/EN ошибку; field errors связаны с полями, network/conflict показаны отдельно.
- Success появляется после подтверждения нужного объекта/состояния; timeout не считается успехом.

### Проверки при реализации

- tests/ui-accessibility.test.tsx для field wiring.
- Поведенческая проверка community submit с задержкой, поздней правкой, отказом и повтором.
- Проверка existing follow checking/error/success без регрессии guards.

### Зависимости и условия

Без обязательных task dependencies.

Mutation confirmation/replay/conflict регулируются docs/FLOWS.md; UI переиспользует существующие adapters. Общие UX primitives можно переиспользовать по готовности; они не блокируют независимое исправление текущего поведения.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/community-topic-form.tsx · L20-L29](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/community-topic-form.tsx#L20-L29)
- [apps/web/src/components/community-topic-form.tsx · L36-L52](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/community-topic-form.tsx#L36-L52)
- [apps/web/src/components/community-topic-form.tsx · L43-L52](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/community-topic-form.tsx#L43-L52)
- [apps/web/src/components/community-topic-form.tsx · L92-L95](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/community-topic-form.tsx#L92-L95)
- [packages/ui/src/button.tsx · L35-L46](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/button.tsx#L35-L46)
- [packages/ui/src/skeleton.tsx · L4-L10](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/skeleton.tsx#L4-L10)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не вводить новый optimistic mutation protocol.
- Loading, reduced motion и honest success уже есть; их нужно сохранить.

## UX-05 — Проверить тему native widgets и читаемую типографику

**Фаза:** F2. **Приоритет:** P2. **Решение:** verification_required. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** color-scheme + longhand typography + autofill styling. theme-preference + design-token-contrast PASS. Browser autofill probe not recorded.

**Исходные пункты:** UI11, UI12, UI21. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** color-scheme, longhand typography и autofill styling на tip; theme-preference + design-token-contrast PASS. Browser autofill probe не записан как evidence.

**Результат.** Проверить native controls и computed typography, исправить подтверждённые расхождения; отдельно оценить понятность theme cycle.

### Область изменений

- `apps/web/src/app/globals.css`
- `apps/web/src/components/theme-toggle.tsx`
- `apps/web/src/lib/theme-preference.ts`
- `apps/web/src/app/layout.tsx`
- `packages/ui/src/platform.tsx`

### Приёмка

- Recorded проверка select/date/checkbox/autofill в обеих темах; color-scheme согласован с resolved theme там, где это требуется.
- Computed font family/size/weight/line-height соответствует роли; нет неожиданных overrides.
- RU/EN ошибки читаемы при 200% текста; reduced motion и contrast сохранены.
- Light/dark/system и storage fallback не регрессируют. Новый theme picker остаётся предложением после проверки, не обязательной заменой.

### Проверки при реализации

- tests/theme-preference.test.ts; tests/design-token-contrast.test.ts.
- Browser check computed styles, autofill и system-theme changes на поддерживаемых браузерах.

### Зависимости и условия

Без обязательных task dependencies.



Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/globals.css · L9-L106](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/globals.css#L9-L106)
- [apps/web/src/components/theme-toggle.tsx · L31-L45](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/theme-toggle.tsx#L31-L45)
- [apps/web/src/components/theme-toggle.tsx · L31-L85](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/theme-toggle.tsx#L31-L85)
- [apps/web/src/lib/theme-preference.ts · L1-L33](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/lib/theme-preference.ts#L1-L33)
- [apps/web/src/app/globals.css · L46-L57](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/globals.css#L46-L57)
- [apps/web/src/app/globals.css · L214-L233](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/globals.css#L214-L233)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не объявлять заранее Safari/Chrome сломанными или минимальный font size универсальным требованием WCAG.
- Не увеличивать всю типографику и не менять theme interaction без подтверждённой пользы.

## UX-06 — Один native modal pattern и понятное подтверждение действий

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Migrated remaining window.confirm call sites to confirmAction (moderation, quarantine, verification, org leave/remove, team directory). rg window.confirm apps/web is empty. dialog-accessibility PASS.

**Исходные пункты:** UI13, UI15. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** ConfirmDialog + confirmAction is the native confirm pattern; window.confirm removed from apps/web. Destructive flows show title/object/consequences; Cancel does not submit; password/slug/revision/busy guards stay at call sites.

**Результат.** Согласовать один native modal pattern и выборочное подтверждение с объектом/последствиями.

### Область изменений

- `apps/web/src/components/build-moderation-controls.tsx`
- `apps/web/src/components/build-quarantine-controls.tsx`
- `apps/web/src/components/confirm-action.tsx`
- `apps/web/src/components/content-moderation-controls.tsx`
- `apps/web/src/components/mobile-nav.tsx`
- `apps/web/src/components/notification-bell.tsx`
- `apps/web/src/components/organization-ownership-transfer.tsx`
- `apps/web/src/components/organization-team-batch.tsx`
- `apps/web/src/components/organization-team-directory.tsx`
- `apps/web/src/components/organization-workspace.tsx`
- `apps/web/src/components/report-moderation-controls.tsx`
- `apps/web/src/components/use-modal-dialog.ts`
- `apps/web/src/components/verification-application-amend.tsx`
- `apps/web/src/components/verification-moderation-controls.tsx`
- `packages/ui/src/dialog.tsx`
- `packages/ui/src/index.ts`

### Приёмка

- Сохраняются Escape/backdrop/Tab/inert background/return focus и локализованный close label.
- Согласована судьба unused Dialog: адаптировать либо не рекомендовать; нет второй конкурирующей реализации.
- В выбранном destructive flow показаны объект, масштаб и последствия; Cancel ничего не отправляет.
- Password/slug/revision checks, audit и busy guard не ослаблены; native confirm остаётся до готовности замены.

### Проверки при реализации

- tests/dialog-accessibility.test.tsx — identity shared primitive.
- scripts/tests/shell-accessibility.playwright.mjs — actual native modal behavior.
- Поведенческая проверка Cancel/confirm/one command на безопасных fixtures.

### Зависимости и условия

UX-02

Destructive transition, полномочия и revision checks описывает docs/FLOWS.md.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/ui/src/dialog.tsx · L32-L47](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/dialog.tsx#L32-L47)
- [packages/ui/src/dialog.tsx · L69-L105](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/dialog.tsx#L69-L105)
- [apps/web/src/components/organization-ownership-transfer.tsx · L50-L77](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/organization-ownership-transfer.tsx#L50-L77)
- [apps/web/src/components/notification-inbox.tsx · L145-L150](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/notification-inbox.tsx#L145-L150)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- ConfirmAction — предложение, не доказательство отсутствия подтверждений.
- Независимый modal bug исправляется без ожидания полного перехода.

## UX-07 — Проверить короткий viewport для More и заголовков секций

**Фаза:** F2. **Приоритет:** P2. **Решение:** verification_required. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** More menu short-viewport scroll + SectionHeader wrap. Playwright shell-accessibility not run this wave.

**Исходные пункты:** UI14, UI19. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** More menu имеет short-viewport scroll; SectionHeader задаёт wrap/gap. Playwright shell-accessibility этой волной не заявляется.

**Результат.** Проверить достижимость содержимого и исправлять только доказанные responsive ограничения.

### Область изменений

- `apps/web/src/components/mobile-nav.tsx`
- `packages/ui/src/platform.tsx`
- `scripts/tests/shell-accessibility.playwright.mjs`

### Приёмка

- В 320×568, 390×480 и landscape доступны начало/конец More и закрытие; focused item виден.
- Overlay учитывает safe area и fixed navigation; при необходимости header доступен, body scrolls.
- Длинный RU section title/action не перекрывается при 320 px и 200% текста.
- При PASS текущего поведения сохранить evidence без искусственной правки кода.

### Проверки при реализации

- scripts/tests/shell-accessibility.playwright.mjs.
- Browser check bounding boxes, keyboard scrolling, first/last controls; одного toBeVisible недостаточно.

### Зависимости и условия

Без обязательных task dependencies.



Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/mobile-nav.tsx · L53-L81](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/mobile-nav.tsx#L53-L81)
- [apps/web/src/components/mobile-nav.tsx · L133-L190](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/mobile-nav.tsx#L133-L190)
- [packages/ui/src/platform.tsx · L50-L69](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/platform.tsx#L50-L69)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Это verification_required, не установленный массовый mobile failure.
- Не блокировать устранение подтверждённой недостижимости refactor UX-06.

## UX-08 — Таблицы сохраняют доступную прокрутку и типы колонок

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** DataTable named overflow + column types; admin audit + statistics numeric. server-statistics-surface PASS.

**Исходные пункты:** UI17, UI18. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Native server-statistics table имеет named focusable scroll region/caption/scope. Shared DataTable минимален, выравнивает последнюю колонку и даёт numeric font всему body.

**Результат.** Сохранить semantic table и доступный overflow, явно задавая тип/выравнивание колонок.

### Область изменений

- `packages/ui/src/platform.tsx`
- `apps/web/src/components/server-statistics-panel.tsx`
- `apps/web/src/app/admin/page.tsx`

### Приёмка

- При overflow область именована, доступна keyboard и показывает focus; body страницы не расширяется.
- Caption/header/cell relations и корректный empty colSpan сохраняются.
- Числа форматируются точечно; текст не становится numeric без причины, alignment колонок явный.
- Длинные UUID/даты/RU действия доступны без наложения.

### Проверки при реализации

- tests/server-statistics-surface.test.tsx.
- Поведенческая проверка audit log/statistics на narrow viewport и длинных fixtures.

### Зависимости и условия

Без обязательных task dependencies.



Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/ui/src/platform.tsx · L187-L234](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/platform.tsx#L187-L234)
- [apps/web/src/components/server-statistics-panel.tsx · L13-L29](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/server-statistics-panel.tsx#L13-L29)
- [packages/ui/src/platform.tsx · L201-L222](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/platform.tsx#L201-L222)
- [apps/web/src/app/admin/page.tsx · L820-L835](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/admin/page.tsx#L820-L835)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не заменять table на ARIA grid без потребности в cell editing.
- Отсутствие explicit scope у простой таблицы не объявляется автоматически нарушением.

## UX-09 — Публичный автор ресурса и ясные связи профиля

**Фаза:** F2. **Приоритет:** P1. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Public author attribution on cards/portfolio; developer/org/user page tests PASS.

**Исходные пункты:** UI20, PX04. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Публичная attribution автора на resource cards/portfolio; различимые Trust/Publications переходы. developer/org/user page tests PASS.

**Результат.** Показать публичное происхождение ресурса и различимые переходы профиля.

### Область изменений

- `apps/web/src/components/product-card.tsx`
- `apps/web/src/app/market/[slug]/page.tsx`
- `apps/web/src/app/developers/[username]/page.tsx`
- `apps/web/src/lib/services/product-service.ts`
- `packages/db/src/repositories/products.ts`

### Приёмка

- Публично допустимое имя/организация и ссылка совпадают с установленной связью ресурса.
- Hidden/missing author даёт честный fallback без private ID/email.
- Trust и Publications разделены spacing, focus и RU/EN wrap.
- Author/current owner различаются по data contract; UI не угадывает identity.

### Проверки при реализации

- scripts/tests/public-portfolio.playwright.mjs.
- Поведенческая проверка public/hidden/missing author и organization attribution; отсутствие N+1 в public projection.

### Зависимости и условия

Без обязательных task dependencies.

Нужна безопасная public identity projection из data/service области; permissions не выводятся из видимости ссылки.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/developers/\[username\]/page.tsx · L94-L106](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/developers/[username]/page.tsx#L94-L106)
- [apps/web/src/components/product-card.tsx · L15-L70](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/product-card.tsx#L15-L70)
- [apps/web/src/app/market/\[slug\]/page.tsx · L190-L240](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L190-L240)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Принятая цель автора на card/detail подтверждена handbook34, а не одним аудитом.

## UX-10 — Локализовать видимые статусы и семантические метки

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Admin status/scan labels RU/EN via status-labels; enums unchanged. i18n-shell PASS.

**Исходные пункты:** UI22. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Admin status/scan labels локализованы RU/EN через status-labels; raw enum values не менялись. Library и managed servers сохраняют свои localized labels.

**Результат.** Согласовать RU/EN status labels без изменения backend enum и смысла badge.

### Область изменений

- `packages/ui/src/platform.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/components/managed-server-card.tsx`
- `apps/web/src/app/workspace/library/page.tsx`

### Приёмка

- Status/scan values имеют локализованный label/tone; неизвестное значение не выглядит success.
- Переведены видимый текст и accessible names.
- Verified, moderation, access, scan и Sponsored остаются разными фактами; technical code допустим в подробностях.

### Проверки при реализации

- tests/i18n-shell.test.ts.
- Markup/behavior check pending/approved/rejected/open/under_review/resolved/dismissed и scan states RU/EN.

### Зависимости и условия

Без обязательных task dependencies.



Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/ui/src/platform.tsx · L133-L146](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/platform.tsx#L133-L146)
- [packages/ui/src/platform.tsx · L170-L179](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/platform.tsx#L170-L179)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не менять enum ради подписи и не заявлять, что весь RU UI нелокализован.

## UX-11 — Честная загрузка и продолжение после server review

**Фаза:** F2. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Server review load failure unavailable+retry, not empty total=0.

**Исходные пункты:** UI04, F06. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Отказ загрузки server reviews показывает unavailable+retry, а не пустой total=0. Mutation/revision protections и post-save next step сохранены.

**Результат.** Различать недоступную загрузку и успешный пустой результат server reviews, затем показывать актуальный результат сохранения и следующий шаг.

### Область изменений

- `apps/web/src/app/servers/[slug]/page.tsx`
- `apps/web/src/components/server-review-panel.tsx`

### Приёмка

- Отказ publicPage показывает локализованную недоступность отзывов и допустимый повтор, не reviews=[]/total=0 и не сообщение «отзывов нет». Успешный ответ с total=0 по-прежнему показывает настоящий empty state; другие доступные блоки server page работают.
- После успеха видны текущий отзыв/статус; при необходимом reload объяснена причина и использован согласованный тихий control.
- Ошибка сохраняет ввод; unconfirmed result не разблокирует опасную повторную запись.
- Status/error roles и focus после результата предсказуемы.

### Проверки при реализации

- tests/server-review-contract.test.ts; tests/server-review-http.test.ts.
- Behavior check save/withdraw/confirmed/failed/unconfirmed responses.
- Behavior check server page: publicPage reject vs successful total=0 vs nonempty response; visible loading/error/empty and retry проверяются раздельно.

### Зависимости и условия

Без обязательных task dependencies.

Полная revision/replay семантика остаётся в docs/FLOWS.md.

Release applicability: before_core_beta_acceptance.

### Источники

- [apps/web/src/components/server-review-panel.tsx · L197-L243](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/server-review-panel.tsx#L197-L243)
- [apps/web/src/app/servers/\[slug\]/page.tsx · L90-L102](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/servers/[slug]/page.tsx#L90-L102)
- [apps/web/src/components/server-review-panel.tsx · L130-L138](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/server-review-panel.tsx#L130-L138)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не ослаблять fail-closed поведение ради плавного UI.
- F06 здесь ограничен catch-fallback загрузки server reviews; не утверждается, что все страницы отзывов маскируют ошибки.

## UX-12 — Аварийный экран с безопасной ссылкой на сбой

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Safe opaque error.digest reference only when present; global-error shell-free; no message/stack/secrets. error-boundary-public-reference + i18n-shell PASS.

**Исходные пункты:** UI24. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** global-error автономен от shell; opaque error.digest только когда присутствует; Retry/Home и RU/EN fallback без message/stack/secrets.

**Результат.** Сохранить автономность и показать безопасный public reference, когда он реально доступен.

### Область изменений

- `apps/web/src/app/global-error.tsx`
- `apps/web/src/app/error.tsx`

### Приёмка

- Retry/Home и локализация работают без shell/provider/основного CSS.
- Показан только согласованный безопасный reference; отсутствие ID не заполняется выдуманным значением.
- Stack/internal messages/secrets не выводятся; keyboard доступен.

### Проверки при реализации

- Behavior check root boundary без shell/provider/CSS: reference present/absent, RU/EN, Retry/Home.
- Проверка отсутствия тестовых секретов и stack в DOM.

### Зависимости и условия

Без обязательных task dependencies.

Public correlation format и support relation согласуются с observability и docs/FLOWS.md.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/global-error.tsx · L38-L64](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/global-error.tsx#L38-L64)
- [apps/web/src/app/global-error.tsx · L109-L145](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/global-error.tsx#L109-L145)
- [docs/handbook/05-UX-AND-DESIGN.md · L7-L13](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/05-UX-AND-DESIGN.md#L7-L13)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Reference — уже существующая цель UX handbook, а не новая incident-система.

## UX-13 — Визуальная приёмка фиксирует нужное состояние страницы

**Фаза:** F3. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Ready capture waits for settled content (no GlobalLoading); loading/empty/error named separately; metadata fixture/state. browser-page-ready 8/8 PASS. Full Playwright PNG evidence still needs disposable CI resource-browser run.

**Исходные пункты:** UI25, F10. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Ready capture ждёт settled content (не GlobalLoading); loading/empty/error именованы отдельно. browser-page-ready focused PASS; полный Playwright PNG evidence остаётся disposable CI resource-browser run.

**Результат.** Screenshot evidence подтверждает заданное состояние, а сценарий проверяет полезный результат.

### Область изменений

- `scripts/tests/public-portfolio.playwright.mjs`
- `scripts/tests/shell-accessibility.playwright.mjs`
- `tests/ui-accessibility.test.tsx`
- `tests/dialog-accessibility.test.tsx`
- `tests/design-token-contrast.test.ts`

### Приёмка

- Ready capture ждёт устойчивого итогового контента; loading/empty/error snapshots именуются отдельно.
- Сохраняется metadata SHA/fixture/state и representative RU/EN themes/narrow/desktop coverage.
- Tabs фильтруют элементы, form сохраняет нужную редакцию, CTA приводит к разрешённому результату.
- UI25 component showcase отдельно рассмотрен как предложение; readiness существующих снимков исправляется независимо.

### Проверки при реализации

- scripts/tests/public-portfolio.playwright.mjs; scripts/tests/shell-accessibility.playwright.mjs.
- Просмотр нового exact-SHA evidence после будущего прогона, без переноса старого PASS на новый SHA.

### Зависимости и условия

Без обязательных task dependencies.

CI/release evidence исполнения координируется engineering областью.

Release applicability: before_browser_acceptance.

### Источники

- [tests/ui-accessibility.test.tsx · L8-L45](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/tests/ui-accessibility.test.tsx#L8-L45)
- [tests/dialog-accessibility.test.tsx · L9-L54](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/tests/dialog-accessibility.test.tsx#L9-L54)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не создавать автоматически публичную UI-витрину.
- Axe и screenshots не доказывают все flows/устройства.

## UX-14 — Общая Home и personal changes summary

**Фаза:** F4. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Home personal changes from watches/follows/replies; guest public-only; cookie opt-out. page + preference tests PASS.

**Исходные пункты:** PX01. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Guest nav hides Workspace cluster/Admin (variant A); member Workspace and Admin follow capabilities on tip.

**Результат.** Согласовать compact first view и personal changes summary реальных ответов/подписок/обновлений.

### Область изменений

- `apps/web/src/app/page.tsx`
- `apps/web/src/components/navbar.tsx`
- `apps/web/src/lib/services/content-service.ts`

### Приёмка

- Guest понимает назначение и следующий шаг на narrow screen без registration wall.
- Personal summary конечен, показывает причину/ссылку к реальному объекту и не заменяет общую Home dashboard.
- New account/empty/partial/error дают честный fallback; private summary доступен текущему actor.
- Есть neutral opt-out experience; до оценки эффекта определены sources и полезный результат пилота.

### Проверки при реализации

- Behavior check guest/new/returning/opt-out/partial failure на safe fixtures.
- Пилот summary измеряет переход к полезному объекту; рост retention не объявляется заранее.

### Зависимости и условия

UX-15, UX-16, FLOW-03, FLOW-08

Sources/subscriptions/private projection согласуются с docs/FLOWS.md; GROW использует эту Home. Home summary читает эффективный watch state, а не только локальный enabled. Сводка ответов должна быть согласована с inbox/read semantics.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/page.tsx · L14-L75](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/page.tsx#L14-L75)
- [docs/handbook/37-HOME-DISCOVER-NAVIGATION-AND-FEEDS.md · L17-L39](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/37-HOME-DISCOVER-NAVIGATION-AND-FEEDS.md#L17-L39)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Personal summary и точная композиция hero остаются proposal.
- Не переопределять owner decision общей Home новым DailyMyMTA.

## UX-15 — Честные данные и явные действия серверной карточки Home

**Фаза:** F2. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Home unknown≠0; partial aggregates labeled; card actions split Connect/View/Copy.

**Исходные пункты:** PX02, F06. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Home server card: unknown≠0; partial aggregates подписаны; действия разделены Connect/View/Copy. Unknown не равен offline.

**Результат.** Исправить смысл данных и сделать назначение server actions предсказуемым.

### Область изменений

- `apps/web/src/app/page.tsx`
- `apps/web/src/components/server-card.tsx`

### Приёмка

- Unknown отличается от измеренного нуля; aggregate честно отмечает неполное покрытие.
- До клика понятно, где просмотр, Join или копирование адреса; название не запускает клиент неожиданно в согласованном варианте.
- NEXUS profile link существует только при доказанном endpoint/entity matching; нет чужой ссылки.
- Минимальный unknown fix независим от обсуждения новой композиции карточки.

### Проверки при реализации

- scripts/tests/directory-smoke.playwright.mjs — сохранить directory semantics.
- Home behavior fixtures: null/zero/positive, stale/partial, mapped/unmapped server.

### Зависимости и условия

Без обязательных task dependencies.

Freshness/observation/entity matching — data/server contract; UI не вычисляет truth по тексту.

Release applicability: before_core_beta_acceptance.

### Источники

- [apps/web/src/app/page.tsx · L97-L116](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/page.tsx#L97-L116)
- [apps/web/src/components/server-card.tsx · L35-L109](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/server-card.tsx#L35-L109)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Unknown не равен offline; никакого выдуманного online.
- Другие F06 honest-state проблемы остаются в своих FLOWS задачах.

## UX-16 — Контекст каталога сохраняется в URL и понятных фильтрах

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Market/Discover URL filters; cursor reset; zero-result recovery. discovery-search + market/discover page tests PASS.

**Исходные пункты:** PX03. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Market и Discover уже используют URL filters и типы сущностей.

**Результат.** Согласовать фильтры и контекст выдачи без потери sharing/Back.

### Область изменений

- `apps/web/src/app/market/page.tsx`
- `apps/web/src/app/discover/page.tsx`
- `apps/web/src/components/discovery-directory.tsx`

### Приёмка

- Shared link и Back восстанавливают те же filters/results.
- Изменение фильтра сбрасывает page/cursor, сохраняя независимые параметры; reset одного не стирает всё.
- Active filters и zero-results объясняют ограничение и доступный следующий шаг.
- Public/private scope и entity types не смешиваются.

### Проверки при реализации

- tests/discover-query.test.ts; tests/discover-surface.test.ts; tests/discovery-search-behavior.test.ts.
- Behavior check URL/back/individual reset Market и Discover в RU/EN.

### Зависимости и условия

Без обязательных task dependencies.

Общие UX primitives можно переиспользовать по готовности; они не блокируют независимое исправление текущего поведения.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/market/page.tsx · L30-L50](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/page.tsx#L30-L50)
- [apps/web/src/app/discover/page.tsx · L40-L100](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/discover/page.tsx#L40-L100)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Saved searches и новая ranking модель не входят в эту унификацию.

## UX-17 — Исходники лицензия и DRM показаны как разные свойства

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** licenseModel RU/EN localized for all enum values; no Open/Closed/DRM invented. Source/DRM metadata remains owner choice (DECISIONS recommends B license-only beta). license-model-i18n + detail acquisition PASS.

**Исходные пункты:** PX05. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Clear-filter CTAs and honest empty/filtered empty copy are on tip across primary filter surfaces.

**Результат.** Согласовать delivery metadata и честное представление source/license/DRM.

### Область изменений

- `packages/domain/src/entities.ts`
- `apps/web/src/components/product-card.tsx`
- `apps/web/src/app/market/[slug]/page.tsx`
- `apps/web/src/components/author-resource-forms.tsx`

### Приёмка

- Текущая licenseModel локализована без изменения смысла enum.
- Open/Closed Source имеет явный data source, не выводится из цены/файла/отсутствия DRM.
- DRM label отображается только при фактической применимости; beta не выдаётся за production DRM.
- Перед новым metadata приняты unknown/default, version applicability и author edit validation.

### Проверки при реализации

- tests/resource-detail-acquisition-ui.test.tsx — сохранить access/download semantics.
- Label fixtures: free/paid-disabled/source unknown/open/closed/DRM disabled без оплаты.

### Зависимости и условия

Без обязательных task dependencies.

Domain/schema/write validation согласуются с data/FLOWS; activation относится к F6. Общие UX primitives можно переиспользовать по готовности; они не блокируют независимое исправление текущего поведения.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/domain/src/entities.ts · L18-L23](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/domain/src/entities.ts#L18-L23)
- [apps/web/src/app/market/\[slug\]/page.tsx · L382-L389](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L382-L389)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Accepted direction из handbook34 не равна принятой схеме нового metadata.
- Существующую licenseModel можно локализовать независимо от расширения.

## UX-18 — Различать отсутствие отзывов получение и установку

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Acquire/install/review absence distinguished on product surfaces; market page tests PASS.

**Исходные пункты:** PX06. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Acquire/install/review absence различаются на product surfaces; 0.0 и counters не выдаются за установку или неизмеренные события.

**Результат.** Понятные рейтинги и счётчики без приписывания установки или других неизмеренных событий.

### Область изменений

- `apps/web/src/components/product-card.tsx`
- `apps/web/src/app/market/[slug]/page.tsx`

### Приёмка

- Ноль отзывов даёт «Пока нет отзывов», а не впечатление плохой оценки.
- Перед переименованием salesCount проверено событие, которое его меняет; claim count только при доказанном соответствии называется добавлениями в библиотеку.
- Метрика не называется установкой/запуском/полной передачей без измерения.
- Иконка имеет доступный смысл; zero и unknown различены.

### Проверки при реализации

- Card markup/behavior: zero/one review, unknown count, длинные RU labels.
- Точечная проверка существующего места обновления salesCount до принятия подписи.

### Зависимости и условия

Без обязательных task dependencies.



Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/product-card.tsx · L39-L52](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/product-card.tsx#L39-L52)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не выводить смысл показателя из имени колонки или иконки.

## UX-19 — Просмотр галереи внутри страницы как расширение

**Фаза:** F2. **Приоритет:** P3. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Native dialog lightbox on resource gallery; original href preserved; focused tests PASS.

**Исходные пункты:** PX07. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Loading/empty/error/success shells distinguish zero, unknown, and load failure on tip honesty wave surfaces.

**Результат.** При принятии добавить accessible lightbox, сохранив original link.

### Область изменений

- `apps/web/src/components/resource-gallery.tsx`
- `apps/web/src/components/resource-preview.tsx`
- `apps/web/src/components/resource-media-editor.tsx`

### Приёмка

- Next/previous/Escape/caption/return focus работают keyboard и touch.
- Original остаётся настоящей ссылкой; после закрытия сохраняется место на странице.
- Empty/deleted/load-error image не ломает overlay.
- Нет arbitrary embeds/HTML execution под видом gallery polish.

### Проверки при реализации

- tests/resource-media-pages.test.tsx; tests/resource-media-normalization.test.ts.
- Behavior check original/open/next/previous/close/failure на local media.

### Зависимости и условия

UX-06



Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/resource-gallery.tsx · L1-L45](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-gallery.tsx#L1-L45)
- [apps/web/src/components/resource-media-editor.tsx · L98-L180](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-media-editor.tsx#L98-L180)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Lightbox — предложение; текущая галерея не считается отсутствующей.

## UX-20 — Инструкция и помощь для конкретного ресурса и версии

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Public resource detail Help/Instructions section bound to current published download version; releaseNotes fenced blocks render as copyable plain code; optional compatibility shows unknown without auto-incompatible claims; support/Q&A links use FLOW-19 object context without private license/evidence.

**Исходные пункты:** PX08, PX12. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Disabled states and retry after error are honest on migrated forms; success confirms from the server.

**Результат.** Структурированная инструкция и контекстная помощь по resource/version без обязательной compatibility metadata.

### Область изменений

- `apps/web/src/app/market/[slug]/page.tsx`
- `apps/web/src/components/resource-download-button.tsx`
- `apps/web/src/components/author-resource-forms.tsx`
- `apps/web/src/app/support/page.tsx`

### Приёмка

- Назначение/установка/настройка/ограничения/поддержка относятся к выбранной версии.
- Код безопасно форматируется/копируется, не выполняется; пользовательский markup не обходит санитизацию.
- Compatibility optional; отсутствие значит unknown, автоматическая несовместимость не выдумывается.
- Support context не публикует private access/license/evidence.
- Download/выдача не называется installed/working.

### Проверки при реализации

- tests/product-dependency-surface.test.tsx; tests/resource-detail-acquisition-ui.test.tsx.
- Behavior check selected version, missing instructions, optional metadata и private support context.

### Зависимости и условия

FLOW-19

Version/download authorization/support permissions заданы docs/FLOWS.md. Контекстный help UI использует согласованный support object context.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/app/market/\[slug\]/page.tsx · L225-L250](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L225-L250)
- [docs/handbook/34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md · L38-L55](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md#L38-L55)
- [apps/web/src/app/market/\[slug\]/page.tsx · L399-L420](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L399-L420)
- [apps/web/src/app/support/page.tsx · L1-L10](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/support/page.tsx#L1-L10)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Новые секции и контекстная помощь остаются proposal, не обязательным publishing gate.

## UX-21 — Одиночное и пакетное получение сохраняют намерение

**Фаза:** F2. **Приоритет:** P1. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Single vs batch acquire intents; guest return without auto-claim; receipt/error states. free acquisition + cart receipts PASS.

**Исходные пункты:** PX09. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Free claim и cart с reviewDigest/receipts работают; оба action доступны на product page.

**Результат.** Понятные single/batch acquire, guest return и version/download states без второй клиентской логики.

### Область изменений

- `apps/web/src/components/resource-cart-controls.tsx`
- `apps/web/src/app/market/[slug]/page.tsx`
- `apps/web/src/components/resource-download-button.tsx`
- `apps/web/src/app/workspace/library/page.tsx`

### Приёмка

- Single acquire и сбор набора различимы; бесплатный состав показан явно.
- После нужного входа возвращается исходное намерение, но оно не исполняется без требуемого подтверждения.
- Owned/pending/unconfirmed/error/receipt states различимы; retry не создаёт новую операцию.
- Download связан с выбранной разрешённой версией и не называется установкой.

### Проверки при реализации

- tests/free-resource-acquisition-surface.test.ts; tests/resource-detail-acquisition-ui.test.tsx; tests/resource-cart-receipts-pages.test.tsx.
- scripts/tests/resource-claim-download.playwright.mjs после соответствующей flow integration.

### Зависимости и условия

FLOW-01

Guest return, reviewDigest, replay/receipt и access guards подробно описаны docs/FLOWS.md; задача — UI integration. Неверный destination Open Library исправляется независимой UX-27 и не ждёт этого более широкого пути. Единый guest-return контракт нужен для одиночного и пакетного получения.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/resource-cart-controls.tsx · L24-L85](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-cart-controls.tsx#L24-L85)
- [apps/web/src/components/resource-cart-controls.tsx · L173-L220](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/resource-cart-controls.tsx#L173-L220)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не дублировать серверную семантику получения. Paid commerce остаётся выключенным.

## UX-22 — Автор видит причины неготовности публикации

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Publication readiness panel on managed resource overview; domain summary + DB snapshot; focused tests PASS; author-workspace playwright not run.

**Исходные пункты:** PX10. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Keyboard and narrow-screen touch targets (min-h-11 / size=touch) are the tip floor for interactive CTAs in honesty waves.

**Результат.** Краткий обзор реального publishing workflow с причиной и переходом к существующему исправлению.

### Область изменений

- `apps/web/src/components/new-resource-form.tsx`
- `apps/web/src/components/author-resource-forms.tsx`
- `apps/web/src/app/workspace/resources/[id]/media/page.tsx`
- `apps/web/src/app/workspace/resources/page.tsx`

### Приёмка

- Description/media/build/scan/moderation отражают реальные состояния и ведут к нужной форме.
- Required и recommendation различены; compatibility и новая инструкция не становятся блокерами.
- Draft recovery/revision сохранены, исправление не создаёт ресурс заново.
- Preview не обещает публикацию, clean не подменяется checklist flag.

### Проверки при реализации

- apps/web/src/components/new-resource-form.test.tsx; tests/author-resource-draft.test.ts.
- tests/workspace-resource-ui-surface.test.tsx; scripts/tests/author-workspace.playwright.mjs.

### Зависимости и условия

UX-03, UX-10, FLOW-20

Publishing transitions/scanner/draft authority остаются в data/FLOWS. Readiness presentation использует тот же lifecycle и причины запрета.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [apps/web/src/components/new-resource-form.tsx · L84-L108](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/new-resource-form.tsx#L84-L108)
- [apps/web/src/components/author-resource-forms.tsx · L157-L195](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/components/author-resource-forms.tsx#L157-L195)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Readiness overview — proposal, не уже принятое обязательное окно.

## UX-23 — Guest и Workspace навигация следует возможностям человека

**Фаза:** F2. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Guest: public nav only, Workspace+Admin hidden, Sign in CTA (DECISIONS A). shell/nav suites PASS.

**Исходные пункты:** PX11, F07. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Library destination and guest More ordering match shell-destination policy on tip.

**Результат.** Согласовать guest/capability presentation и сгруппировать задачи без жёсткого выбора роли.

### Область изменений

- `apps/web/src/components/sidebar.tsx`
- `apps/web/src/components/mobile-nav.tsx`
- `apps/web/src/components/account-controls.tsx`
- `apps/web/src/app/workspace/page.tsx`

### Приёмка

- Protected item имеет выбранную политику hidden либо честный sign-in/onboarding CTA, не видимость рабочей функции без доступа.
- Library/servers/publications/replies сгруппированы по реальным объектам и возможностям; остальные действия обнаружимы.
- Пользователь совмещает роли; organization context не теряет личный.
- Истории и разрешённые данные доступны после перегруппировки; server authz обязателен.

### Проверки при реализации

- tests/workspace-closed-beta-surfaces.test.ts; tests/server-workspace-ui-surface.test.tsx.
- scripts/tests/shell-accessibility.playwright.mjs с guest/member/creator/server-owner fixtures.

### Зависимости и условия

Без обязательных task dependencies.

Effective capabilities/context — auth/data; intent-preserving auth — docs/FLOWS.md.

Release applicability: fix_confirmed_destination_before_beta; navigation_redesign_is_optional.

### Источники

- [apps/web/src/app/workspace/page.tsx · L99-L183](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/workspace/page.tsx#L99-L183)
- [docs/handbook/33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md · L5-L28](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md#L5-L28)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- F07 — продуктовая согласованность, не security incident.
- Принята общая capability direction, но точная guest navigation policy ещё needs_decision.
- Needs_decision относится только к композиции guest/Workspace и capability presentation. Подтверждённый Open Library destination bug вынесен в UX-27 и исправляется независимо.

## UX-24 — Управляемое рекламное размещение и его lifecycle

**Фаза:** F5. **Приоритет:** P3. **Решение:** proposal. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** local_development.

**Исходные пункты:** AD01, AD07. **Решения обсуждения:** NX-010, NX-011.

**Сейчас.** Есть sponsored badge и fixed-price inventory target; законченный runtime placements не установлен. Конкретный lifecycle — предложение.

**Результат.** Согласовать admin-managed placement contract; после принятия локально реализовать slot/time/capacity/eligibility/audit основу.

### Область изменений

- `docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md`
- `docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md`
- `packages/domain/src/entities.ts`
- `packages/db/src/schema.ts`
- `apps/web/src/app/admin/page.tsx`

### Приёмка

- Slot и placement разделены; определены start/end/capacity/audience/target/moderation basis.
- Приняты lifecycle states и допустимые переходы/причины отказа.
- До/после срока, delisted/quarantined target не показывается; актуальная eligibility перепроверяется.
- Concurrent booking не превышает capacity; pause имеет причину и audit.
- Новые model/service/repository имена назначаются при принятии архитектуры, не выдаются за уже существующие.

### Проверки при реализации

- Review модели/переходов на fixtures до создания новой схемы.
- После принятия: behavior checks time boundaries, concurrent capacity, pause/resume, quarantine и operator rights; новые test paths назначаются при реализации.

### Зависимости и условия

Без обязательных task dependencies.

Concurrency/authz/audit — engineering/FLOWS; billing и commercial activation — F6.

- Условно OPS-06: Если выбранная реализация добавляет или изменяет схему БД.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/ui/src/platform.tsx · L80-L125](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/platform.tsx#L80-L125)
- [docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md · L70-L85](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md#L70-L85)
- [docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md · L83-L85](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md#L83-L85)
- [docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md · L92-L102](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md#L92-L102)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Owner fixed-price direction не утверждает новые состояния/тарифы/live campaign.
- Не включать оплату, продажу инвентаря, production campaigns или внешние trackers.

## UX-25 — Рекламный слот маркирован и отделён от органики

**Фаза:** F5. **Приоритет:** P2. **Решение:** proposal. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** local_development.

**Исходные пункты:** AD02, AD03, AD04, AD05, AD06. **Решения обсуждения:** NX-010, NX-011.

**Сейчас.** Маркировка и отдельный organic score — confirmed target; точные места/no-fill/экранные исключения ещё требуют выбора.

**Результат.** Согласовать SponsoredPlacement renderer: маркировка, стабильная композиция, независимая органика и критические исключения.

### Область изменений

- `packages/ui/src/platform.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/market/page.tsx`
- `apps/web/src/app/servers/page.tsx`
- `apps/web/src/app/discover/page.tsx`
- `docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md`

### Приёмка

- Реклама/Sponsored и рекламодатель понятны до клика в RU/EN; editorial/platform announcement названы иначе.
- Paid insertion не меняет organic score/order/real metrics/trust; dedup/frequency имеют явный контракт.
- Согласованы Home/catalog/mobile positions; не перекрыты search/navigation/primary action/download.
- No-fill/expired/error/ineligible оставляют страницу рабочей; late load не сдвигает кнопку под пальцем.
- Предложенный запрет ads в auth/recovery/security/report/acquisition confirmation/admin принят либо заменён явной матрицей.

### Проверки при реализации

- Fixture behavior check fill/no-fill/delay/error/expired/ineligible: narrow/desktop, keyboard, themes.
- Проверка одинакового organic order до/после placement и отсутствия paid trust effects.

### Зависимости и условия

UX-02, UX-24

Модель placement/eligibility — UX-24; внешнее включение имеет отдельный gate.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [packages/ui/src/platform.tsx · L121-L125](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/packages/ui/src/platform.tsx#L121-L125)
- [docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md · L47-L58](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md#L47-L58)
- [docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md · L74-L81](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md#L74-L81)
- [apps/web/src/app/page.tsx · L35-L75](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/page.tsx#L35-L75)
- [docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md · L35-L58](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md#L35-L58)
- [docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md · L83-L85](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md#L83-L85)
- [docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md · L93-L101](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md#L93-L101)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Позиция после первой полезной секции — proposal.
- Sponsored не означает identity/clean build/качество; такие исходы не продаются.

## UX-26 — Причины показа контроль рекламы и честные измерения

**Фаза:** F5. **Приоритет:** P3. **Решение:** proposal. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** local_development.

**Исходные пункты:** AD08, AD09. **Решения обсуждения:** NX-010, NX-011.

**Сейчас.** Opt-out/explainability — принятые направления; hide/report ads и единицы рекламных измерений ещё не реализованы.

**Результат.** Согласовать why shown, hide/report и честную отчётность без скрытого профилирования.

### Область изменений

- `docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md`
- `docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md`
- `apps/web/src/app/settings/page.tsx`
- `apps/web/src/app/admin/page.tsx`

### Приёмка

- Why shown объясняет допустимый тип причины без private/anti-abuse signals.
- Opt-out даёт contextual/explicit-filter опыт без behavioral-profile ranking.
- Hidden placement не возвращается немедленно; report привязан к placement/target без чужих данных.
- Отдача слота, видимый показ, клик и полезное действие различены; определены period/dedup/internal traffic/unknown.
- Ad report не меняет organic reputation и не доказывает выполнение обязательств наличием слота.

### Проверки при реализации

- Review privacy/event schema и единиц измерения до telemetry.
- Local behavior check opt-out/hide/report/unknown states.
- Controlled event fixtures: dedup/internal traffic после принятия модели.

### Зависимости и условия

UX-24, UX-25

Privacy retention/moderation/metrics — соответствующие domain owners; коммерческие обязательства не задаёт UI.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md · L60-L91](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md#L60-L91)
- [docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md · L83-L85](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md#L83-L85)
- [docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md · L93-L102](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md#L93-L102)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение или включение.
- Не устанавливать сторонний tracking и не делать live experiment без разрешения.
- Цены/гарантии/рост эффективности не выводятся из макета.

## UX-27 — Open Library открывает библиотеку вместо общего Workspace

**Фаза:** F2. **Приоритет:** P2. **Решение:** existing_goal. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Open Library href=/workspace/library on market+acquire success paths.

**Исходные пункты:** F07, PX09. **Решения обсуждения:** NX-005, NX-006, NX-008, NX-011.

**Сейчас.** Open Library на market/acquire success ведёт в /workspace/library. Подпись соответствует экрану назначения; guest/owner branching и acquisition receipts не менялись.

**Результат.** Исправить destination существующей ссылки Open Library на /workspace/library без редизайна Workspace и изменения доступа.

### Область изменений

- `apps/web/src/app/market/[slug]/page.tsx`
- `tests/resource-detail-acquisition-ui.test.tsx`

### Приёмка

- У авторизованного пользователя существующая ссылка Open Library имеет href=/workspace/library и открывает библиотеку, а не общий обзор Workspace.
- Подпись остаётся локализованной и соответствует экрану назначения; библиотека работает и с пустым списком.
- Права доступа, private caching, acquisition receipts и guest/owner branching не меняются.
- Правка не зависит от ButtonLink, Field, нового onboarding или решения о guest navigation.

### Проверки при реализации

- tests/resource-detail-acquisition-ui.test.tsx: проверить точный href существующей ссылки.
- Поведенческая проверка перехода с resource detail к heading библиотеки на безопасном авторизованном fixture.

### Зависимости и условия

Без обязательных task dependencies.

Независимое минимальное исправление F07. UX-23 обсуждает композицию навигации, UX-21 — общий acquire flow; ни одна не является prerequisite.

Release applicability: fix_confirmed_destination_before_beta; navigation_redesign_is_optional.

### Источники

- [apps/web/src/app/market/\[slug\]/page.tsx · L424-L430](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/market/[slug]/page.tsx#L424-L430)
- [apps/web/src/app/workspace/library/page.tsx · L42-L73](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/apps/web/src/app/workspace/library/page.tsx#L42-L73)

### Ограничения

- Review package v1: specified — подготовленный контракт, не разрешение на внедрение.
- Не вводить новый library route, реорганизацию навигации или повторный механизм получения.

## GROW-01 — Определить полезный возврат и минимальные события измерения

**Фаза:** F4. **Приоритет:** P2. **Решение:** accepted_direction. **Очередь:** specified. **Исполнение:** done. **Область полномочий:** local_development.

**Заметка исполнения.** Docs-only activation dictionary in RETENTION-PLAN (per-role confirmed outcomes; signup≠activated; windows). No pilot/analytics pipeline.

**Исходные пункты:** RET01. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Growth pilots remain deferred without activation; GROW-01 direction accepted, pilots UX-24–26 / GROW-02…09 stay gated.

**Результат.** До пилота отделить интерес, доставку, получение файла и подтверждённую пользу.

### Область изменений

- `docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md`
- `planned: docs/RETENTION-PLAN.md`
- `planned: minimal first-party event adapters`

### Приёмка

- Для каждой роли определены activation event, t0, outcome, дедупликация и созревший знаменатель.
- D7/D30 и W1/W4 имеют разные явные окна; signup и activated cohorts показываются отдельно.
- Клики, claim, выданные bytes, RSVP и provider acceptance не выданы за установку/участие/прочтение.
- Есть минимизация данных, purpose/retention/access; security telemetry отделена от marketing.
- Baseline и budget пилота определены до выводов; нет обещаний uplift без данных.

### Проверки при реализации

- Сверка event dictionary с outcome/actor/object/purpose и доступными существующими событиями.
- На синтетических примерах проверить дедупликацию, границы D7/D30/W1/W4 и исключение несозревших когорт; это проверка определения, не результат живого пилота.
- Если в этой задаче добавлена минимальная instrumentation, focused проверка соответствия событий контракту и отсутствия лишних приватных данных.

### Зависимости и условия

Без обязательных task dependencies.

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.

## GROW-02 — Подготовить ограниченный пилот поддерживаемых стартовых подборок

**Фаза:** F4. **Приоритет:** P2. **Решение:** proposal. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** RET02. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Частные коллекции уже существуют; редакционные проверенные наборы требуют содержания и ответственного.

**Результат.** Помочь новому владельцу решить одну настоящую задачу с понятными версиями и ограничениями.

### Область изменений

- `docs/handbook/33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md`
- `planned: editorial starter collection specifications`

### Приёмка

- Выбраны ограниченные темы и редактор, указан источник каждого ресурса и дата проверки.
- Порядок действий и ограничения понятны; работоспособность всей связки подтверждается отдельной проверкой.
- Редакционный/перенесённый материал помечен, устаревание и предложенное исправление видны.
- Проверяется решённая задача пользователя и время сопровождения, а не число созданных коллекций.

### Проверки при реализации

- До запуска: brief с ролью, outcome, baseline, окном, хозяином и лимитом нагрузки.
- После разрешённого пилота: фактические результаты, отрицательные сигналы и решение stop/change/continue; не объявлять uplift без достаточного сравнения.

### Зависимости и условия

GROW-01

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.

## GROW-03 — Проверить формат Lua-мастерской и очереди помощи

**Фаза:** F4. **Приоритет:** P2. **Решение:** proposal. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** RET03. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Публикации и обсуждения доступны; регулярный формат и дежурная очередь ещё не запущены этим планом.

**Результат.** Получать воспроизводимые решения вопросов и оставлять полезный материал следующим читателям.

### Область изменений

- `docs/handbook/19-COMMUNITY-AND-RETENTION.md`
- `planned: workshop brief and outcome template`

### Приёмка

- Заранее определены ведущий, конечный scope, формат окружения/кода, предел часов и порядок зависших вопросов.
- Автор вопроса может подтвердить результат; примеры не раскрывают секреты и чужие приватные файлы.
- После пилота есть решения/памятка и фактическая нагрузка; отсутствие результата не скрыто числом комментариев.
- Для ручного пилота не требуется строить новый forum/calendar; приглашения не отправляются без поручения.

### Проверки при реализации

- До запуска: brief с ролью, outcome, baseline, окном, хозяином и лимитом нагрузки.
- После разрешённого пилота: фактические результаты, отрицательные сигналы и решение stop/change/continue; не объявлять uplift без достаточного сравнения.

### Зависимости и условия

GROW-01

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.

## GROW-04 — Проверить один игровой или тестовый вечер

**Фаза:** F4. **Приоритет:** P2. **Решение:** proposal. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** RET04. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Серверы и контент дают основу; полный calendar/events runtime не предполагается готовым.

**Результат.** Проверить повторяемость участия до создания крупной событийной подсистемы.

### Область изменений

- `docs/handbook/24-SERVERS-ORGANIZATIONS-AND-PROFILES.md`
- `planned: event pilot brief`

### Приёмка

- У формата есть реальный host, условия участия, ограниченная цель и процедура отмены/переноса.
- RSVP/переход отделён от подтверждения участия; источник подтверждения прозрачен.
- Зафиксирован результат, жалобы, время host и возможность повторить цикл без постоянных личных напоминаний.
- Автоматический календарь, push-подписки и вознаграждения не включаются незаметно в ручной пилот.

### Проверки при реализации

- До запуска: brief с ролью, outcome, baseline, окном, хозяином и лимитом нагрузки.
- После разрешённого пилота: фактические результаты, отрицательные сигналы и решение stop/change/continue; не объявлять uplift без достаточного сравнения.

### Зависимости и условия

GROW-01

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.

## GROW-05 — Провести ограниченный клуб тестировщиков

**Фаза:** F4. **Приоритет:** P2. **Решение:** proposal. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** RET05. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Выбор сборок и обсуждения можно использовать; matchmaking и QA-service не реализуются по умолчанию.

**Результат.** Автор получает воспроизводимый отчёт, тестер — обратную связь о принятии и исправлении.

### Область изменений

- `docs/handbook/34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md`
- `planned: test request and report templates`

### Приёмка

- Запрос содержит версию, окружение, несколько наблюдаемых сценариев, размер группы и конечный срок.
- Отчёт отличает воспроизведено/не воспроизведено/исправлено; автор отвечает на принятый вклад.
- Пилот имеет лимит нагрузки и право закончиться; нет обязательства бесплатной постоянной QA-поддержки.
- Признание вклада не даёт автоматически staff/security прав и не награждает число кликов.

### Проверки при реализации

- До запуска: brief с ролью, outcome, baseline, окном, хозяином и лимитом нагрузки.
- После разрешённого пилота: фактические результаты, отрицательные сигналы и решение stop/change/continue; не объявлять uplift без достаточного сравнения.

### Зависимости и условия

GROW-01

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.

## GROW-06 — Проверить доску реальных потребностей без полноценной биржи

**Фаза:** F4. **Приоритет:** P3. **Решение:** proposal. **Очередь:** deferred. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** RET06. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Есть контент и обсуждения; отдельная структурированная demand board — новая возможность.

**Результат.** Отличить реальную повторяющуюся проблему от голосования за абстрактную идею.

### Область изменений

- `docs/handbook/19-COMMUNITY-AND-RETENTION.md`
- `planned: demand brief and resolution fields`

### Приёмка

- Карточка содержит задачу, существующий обходной путь и критерий результата.
- Отклик/прототип/готовый ресурс привязан к потребности; закрытие ведёт к результату.
- Голос означает интерес, не платёжеспособный спрос, контракт или обязанность автора.
- Начало возможно вручную поверх контента; оплата/escrow/заказы остаются отдельным решением.

### Проверки при реализации

- До запуска: brief с ролью, outcome, baseline, окном, хозяином и лимитом нагрузки.
- После разрешённого пилота: фактические результаты, отрицательные сигналы и решение stop/change/continue; не объявлять uplift без достаточного сравнения.

### Зависимости и условия

GROW-01

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.

## GROW-07 — Проверить devlog и добровольный редакционный дайджест

**Фаза:** F4. **Приоритет:** P2. **Решение:** proposal. **Очередь:** needs_decision. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** RET07. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Публикации, follows и уведомления уже существуют; новый дайджест не должен дублировать их бесконтрольно.

**Результат.** Дать конкретный повод вернуться к релизу, решению или событию с понятным следующим действием.

### Область изменений

- `docs/handbook/19-COMMUNITY-AND-RETENTION.md`
- `docs/handbook/37-HOME-DISCOVER-NAVIGATION-AND-FEEDS.md`
- `planned: digest pilot specification`

### Приёмка

- Devlog связан с настоящим изменением или обратной связью; пустой bump не становится активностью.
- Дайджест добровольный, имеет отписку и предпочтения; пустой/повторный выпуск не отправляется.
- Security уведомления не смешаны с экспериментом; существующие category/mute настройки соблюдены.
- Результат оценивается по полезному возврату и нагрузке/отпискам; opens/CTR — только часть воронки.

### Проверки при реализации

- До запуска: brief с ролью, outcome, baseline, окном, хозяином и лимитом нагрузки.
- После разрешённого пилота: фактические результаты, отрицательные сигналы и решение stop/change/continue; не объявлять uplift без достаточного сравнения.

### Зависимости и условия

GROW-01

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

- Условно FLOW-09: При добавлении новой доставки digest через существующие notification channels.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.

## GROW-08 — Описать версионированный набор ресурсов для сервера

**Фаза:** F4. **Приоритет:** P3. **Решение:** proposal. **Очередь:** deferred. **Исполнение:** not_started. **Область полномочий:** local_development.

**Заметка исполнения.** 2026-11-01: local proposal draft at docs/SERVER-PACK-SPEC.md (manual snapshot shape, non-goals, sample probe). Still blocked on GROW-02 pilot selection; no runtime/schema.

**Исходные пункты:** RET08. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Collection manifest содержит product IDs; точные build/version и проверка совместного запуска — отдельный контракт.

**Результат.** Получить воспроизводимый snapshot набора, не переписывая уже имеющиеся коллекции и выбор версии.

### Область изменений

- `docs/SERVER-PACK-SPEC.md`
- `packages/domain/src/library-collections.ts`
- `planned: versioned server pack specification`

### Приёмка

- Snapshot хранит точные версии, конфигурацию/порядок, автора, дату и результаты проверки.
- Self-declared окружение не представлено автоматическим обнаружением; pin меняется только явным действием.
- Права на каждый файл проверяются отдельно; snapshot не передаёт право перепубликовать архивы.
- Проверено, что небольшой ручной формат полезен, прежде чем строить install-agent или auto-update.

### Проверки при реализации

- Использовать фактические выводы завершённого GROW-02 как входные требования.
- Проверить образец snapshot двух ресурсов: exact build identity, права доступа, явное обновление pin, устаревшее окружение и отсутствие файлов, на перепубликацию которых нет права.
- Смысловая проверка спецификации; будущая установка/автообновление не выдаются за выполненный пилот.

### Зависимости и условия

GROW-02

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

- Условно OPS-06: Если выбранная реализация добавляет или изменяет схему БД.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.

## GROW-09 — Проверить публичные кейсы и признание полезного вклада

**Фаза:** F4. **Приоритет:** P3. **Решение:** proposal. **Очередь:** deferred. **Исполнение:** not_started. **Область полномочий:** external_live.

**Исходные пункты:** RET09. **Решения обсуждения:** NX-009, NX-011.

**Сейчас.** Профили/публикации есть; отдельная модель подтверждённого вклада — новая продуктовая работа.

**Результат.** Показать результат работы автора или помощника с проверяемым основанием и согласием на публичность.

### Область изменений

- `docs/handbook/21-REPUTATION-VERIFICATION-AND-REVIEWS.md`
- `docs/handbook/36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md`
- `planned: portfolio case and contribution evidence templates`

### Приёмка

- Кейс содержит задачу, окружение, сделанное и результат; самоотчёт явно обозначен.
- Признание ссылается на конкретного получателя пользы; self/team credit отделён, возможны исправление и обжалование.
- Нет XP-валюты за клики/посты, покупки verification или переноса популярности в безопасность файла.
- Измеряются повторный качественный вклад и время проверки, а не число выданных значков.

### Проверки при реализации

- До запуска: brief с ролью, outcome, baseline, окном, хозяином и лимитом нагрузки.
- После разрешённого пилота: фактические результаты, отрицательные сигналы и решение stop/change/continue; не объявлять uplift без достаточного сравнения.

### Зависимости и условия

GROW-01

Сначала выбрать один пилот; перечисление не является командой запустить все механики.

Release applicability: scope_specific_acceptance_not_a_universal_launch_gate.

### Источники

- [docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md · L5-L36](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md#L5-L36)
- [docs/handbook/19-COMMUNITY-AND-RETENTION.md · L1-L35](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/19-COMMUNITY-AND-RETENTION.md#L1-L35)

### Ограничения

- Пилот ещё не проведён; численные эффекты, сроки и бюджеты не измерены.
- Внешние публикации, приглашения и рассылки не выполняются этим пакетом.
