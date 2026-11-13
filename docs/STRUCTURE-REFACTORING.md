# Архитектурный рефакторинг: Phase 0 и план миграции

**Статус:** Phase 0 подготовлена; приложение локально перенесено в `site/` в Phase 1.
Приёмка переноса описывается в разделе 14. Направление
структуры принято поручением владельца. Владелец разрешил автономное продолжение по плану; интеграционные gates сохраняются.
**Срез:** ветка `work`, HEAD `948884b362687aa99c1425beb08a75cd4b0b89af`,
13 ноября 2026. Начальный `git status --porcelain=v1` пуст. Все приведённые проверки
относятся к этому HEAD с локальными изменениями Phase 0, а не к новому коммиту/CI.
Исторический `baseline_sha` tracker — `385e577e7443cf7d7b817419ce5c3b8afe87b690`.
Справочный SHA поручения `7f6773b3…` не использовался вместо текущего checkout.

Этот документ хранит техническую последовательность и приёмку переноса. Действующие
правила остаются в [ARCHITECTURE](ARCHITECTURE.md), рабочий контракт — в
[AGENT](AGENT.md), операторские команды — в [OPERATIONS](OPERATIONS.md).
Это не новый tracker: статус карточек остаётся только в `planning/tasks.json`.

**Актуализация после поручения «Продолжай»:** полный planning audit и renderer
проверены локально с PASS; исходные frozen bytes восстановлены по Git/manifest,
а четыре изменения спецификаций связаны с точными Git evidence. Первичные FAIL
ниже сохранены как история расследования; текущие результаты — в разделе 13.

## 1. Фактическое состояние

Модульный монолит Next.js 16.4.4 / React 19.3.1; TypeScript 7, Vitest 5,
PostgreSQL 18 / Drizzle. Корневые pnpm scripts, workspace и lockfile объединяют
приложение и семь пакетов. Exact pins: Node 26.10.0 и pnpm 12.4.2. Совместимость
analyzer с TypeScript обеспечена SWC и отдельным TypeScript 6 через packageExtensions.
Это особенность текущего инструментария, а не основание менять его во время переноса.

| Место                        | Фактическая ответственность и связь                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/`          | Next App Router: layout/pages, RSC, API `route.ts`, routing и metadata                                         |
| `apps/web/src/lib/services/` | 85 `.ts` файлов (включая вспомогательные модули); сценарии пользователя, оркестрация, политика доставки        |
| `apps/web/src/components/`   | Компоненты продукта и общие оболочки сайта, рядом часть UI-тестов                                              |
| `apps/web/src/lib/`          | HTTP/browser adapters, locale, view models, клиентские helpers; ответственности различаются по файлам          |
| `apps/web/scripts/`          | Capture наблюдений серверов и replay обсуждений; отдельные operational entrypoints                             |
| `packages/domain/`           | Независимые типы, ошибки, правила и события                                                                    |
| `packages/validation/`       | Входные схемы, безопасные ссылки, общие ограничения                                                            |
| `packages/security/`         | Авторизация, сессии, идентификаторы и лимиты                                                                   |
| `packages/config/`           | Программная проверка env; не каталог конфигурационных шаблонов                                                 |
| `packages/storage/`          | Приватные файлы, атомарная публикация и целостность                                                            |
| `packages/db/src/`           | Схема, client, migrate, seeds и 181 `.ts` файл repositories (включая вспомогательные/тестовые)                 |
| `packages/db/migrations/`    | 90 SQL-файлов и служебные metadata; forward-only история                                                       |
| `packages/db/scripts/`       | Mail/push/resource-release/license workers, scenario lab, guards и upgrade rehearsal                           |
| `packages/ui/`               | Переиспользуемые UI-примитивы; собственная UI-система сохраняется                                              |
| `tests/`                     | Общие HTTP, UI, поведенческие и PostgreSQL suites и fixtures; colocated suites также в app/packages            |
| `scripts/`                   | Автоматизация, test classification, release evidence, health, browser и infrastructure harnesses               |
| `deploy/`                    | Только `Caddyfile` и `infra-image-pins.json`                                                                   |
| Корень                       | `Dockerfile` с development/build/runtime stages, 11 `compose*.yaml`, `.env.example`, конфигурации инструментов |
| `configs/`                   | Отсутствует; переносить нечего. Корневой `.env.example` рассматривается отдельно в Phase 3                     |
| `docs/`, `planning/`         | Действующие контракты, производные views, рабочий JSON tracker и frozen evidence                               |
| `.github/`                   | CI, auth/directory/resource browser, discussion recovery workflows и Dependabot                                |

Граф **декларированных workspace dependencies**, проверенный по package.json:

```text
web        → config, db, domain, security, storage, ui, validation
db         → config, domain, security, validation
storage    → config, domain
security   → domain
validation → domain
config     → (нет workspace dependencies)
ui         → (нет workspace dependencies)
domain     → (нет workspace dependencies)
```

Это декларации, не подмена анализа всех импортов. Фактические границы и циклы
проверяет dependency-cruiser. Скрипты пакета DB могут оркестрировать app в test
scenarios; это не разрешение package `src` импортировать приложение.

## 2. Инвентаризация ссылок и метод повторения

Полный индекс файлов/номеров строк на исходном SHA:
[`structure-path-inventory.json`](../planning/structure-path-inventory.json).
Он отделяет programmatic consumers, документы/planning и frozen historical snapshots.
На срезе: 1 353 уникальных файла; `apps/web` — 1 025, `packages` — 383,
`tests` — 73, `deploy` — 31, `configs` — 0. Категории пересекаются.
Учитываются обычные/экранированные пути и quoted path segments в `path.join`.
Это индекс свидетельств, не список для глобальной замены.

Воспроизведение (результат писать во временный файл, не обновлять baseline молча):

```bash
python planning/tools/inventory_structure.py --revision 948884b362687aa99c1425beb08a75cd4b0b89af --output /tmp/nexus-structure-inventory.json
rg -n --hidden -g '!.git/**' -g '!node_modules/**' -g '!**/.next/**' 'apps/web|packages/|tests/|deploy/|configs/' .
rg -n 'packages|apps|web|tests|deploy|configs' scripts .github Dockerfile compose*.yaml
```

Первый шаг воспроизводит Git snapshot; второй/третий проверяют текущий checkout,
включая новые файлы. Индекс не доказывает отсутствие произвольной динамической
конкатенации. Отдельно прочитаны вычисляемые пути: `scripts/test-projects.mjs`
(`path.join(root, "packages", …)`, точное сравнение DB client),
`run-tooling-tests.mjs`, `run-focused-tests.mjs`, `run-isolated-tests.mjs`,
`apps/web/next.config.mjs`, shell entrypoint и Compose mounts. Перед каждым
этапом повторить поиск на новом HEAD, включая относительные `../../` импорты,
fixtures, регулярные выражения, glob filters и строки `readFileSync`.

## 3. Целевая структура

```text
site/
  src/{app,features,components,lib}/
  packages/{ui,domain,db,security,validation,storage,config}/
  tests/
  next.config.mjs
  package.json
  tsconfig.json
docker/
  Dockerfile
  compose.yaml
  compose.production.yaml
  compose.verify.yaml
  ... остальные overlays, Caddyfile, infra-image-pins.json
config/
  env/                  # шаблоны; без реальных секретов
scripts/
docs/
planning/
.github/
AGENTS.md
README.md
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
```

Корневые конфигурации инструментов остаются, где это требуется инструментами.
Имена `@nexus/*` сохраняются. `site/packages/config/` валидирует env программно;
`config/env/` содержит шаблоны. Для `.env.example` нужно согласованно обновить
consumers и `.dockerignore`, а не переносить вслед за отсутствующим `configs/`.

## 4. Migration Map: зависимости, сбои, приёмка и восстановление

### Phase 1: `apps/web/` → `site/`

**Файлы интеграции:** root `package.json` (команды тестов/depcruise),
`pnpm-workspace.yaml`, importers/links в `pnpm-lock.yaml`, root/app tsconfig,
app package lint path, `next.config.mjs`, `.dependency-cruiser.cjs` и exceptions,
`knip.jsonc`, `biome.json`, `vitest.config.ts`, `scripts/ci-policy.mjs`,
`Dockerfile`, `compose.yaml`, `scripts/start-production.sh`, workflows, test
fixtures и остальные programmatic строки из индекса. Проверить Tailwind source
scanning и относительные CSS-импорты в `globals.css`, app script imports и
`playwright.ci.config.mjs`. GitHub discussion-recovery path filters меняются вместе
с путями, чтобы события не перестали запускать gate.

**Переходная структура:** `site` + корневые `packages/*` и `tests/`.
TS aliases app становятся `../packages/*` до Phase 2; tracing root — корень repo
(из нового next.config это `../`, а не `../../`). Нельзя заранее переключать
пакетные aliases на несуществующие `site/packages`.

**Сбои:** импорт resolve, утраченное покрытие API policy/Biome, отсутствие
static assets в runtime, traced dependencies вне образа, source fixtures читают
старый путь, workspace install drift. Для packages→app правило обязано запрещать
новый `site/src/`, а не весь `site/`, внутри которого позже окажутся пакеты.

**Приёмка:** frozen install; format/lint/typecheck/Knip/depcruise/unit/tooling;
focused route/fixture/policy suites, isolated DB по CI scope; Next default build;
production runtime image и browser/static/readiness smoke; local Compose hot
reload; полное применимое CI. Нет оставшихся активных старых путей без объяснения.
Отдельный этап возможен только с согласованным изменением всех consumers.

**Восстановление:** вернуть целиком коммит интеграции путей, пересобрать старый
образ и проверить startup; не выбирать отдельные обратные замены. При локальной
непринятой работе восстановить только собственный diff. Не затрагивать volumes/БД.

### Phase 2: `packages/` → `site/packages/`, `tests/` → `site/tests/`

**Файлы интеграции:** workspace globs `site` и `site/packages/*`, lockfile links,
оба tsconfig, Vitest aliases, Knip workspaces/entry/project, depcruise CLI scope,
все regex границ, Tailwind UI scanning, direct relative imports и `vi.mock`
fixtures, root package scripts, `scripts/test-projects.mjs` (включая client marker),
`run-tooling-tests.mjs` (поиск DB tooling), focused/isolated runners, coverage,
Docker/Compose mounts/working_dir, health и production entrypoints, browser,
release/upgrade/seed/scenario harnesses, workflow filters и CI policy.
Проверить `packages/db/drizzle.config.ts`, migrate journal/SQL lookup и пути
DB deploy graph; package-relative пути могут сохраниться, root-relative — нет.

**Сбои:** suite ошибочно попала в unit вместо database; tooling runner перестал
находить DB tests; aliases смотрят в старую копию; pnpm deploy потерял SQL/tsx;
миграции находятся только в checkout, но отсутствуют в runtime image.

**Приёмка:** перечислить suite inventory до/после (точные имена и project
membership), отсутствие пропавших suite, все негативные архитектурные fixtures;
workspace graph и package имена сохранены; frozen install, check:code, disposable
DB/integration и upgrade rehearsal, migrations/workers/image/browser gates.
Проверить deployment `@nexus/db --prod deploy` с содержимым SQL и entrypoints.

Пакеты и общие тесты можно переносить двумя подэтапами, если у каждого полный
набор согласованных consumers и зелёная интеграционная граница. После переноса
app aliases меняются на `./packages/*`. **Восстановление:** revert соответствующего
целого подэтапа и прежний image; SQL/metadata и пользовательские данные не меняются.

### Phase 3: `deploy/` → `docker/`, корневой Dockerfile/Compose → `docker/`

Начальная карта из поручения недостаточна: основная инфраструктура сейчас в
корне. Перенести также Dockerfile и все 11 Compose overlays; Caddyfile и image
pins перемещаются из `deploy`. Согласованно изменить root scripts, workflows
(`file: docker/Dockerfile` при сохранённом build context repo root), `.dockerignore`,
`nexus-doctor`, evidence/upgrade/backup/production/local/mail harnesses и тесты
Compose overlay matrix, pin resolution, health/entrypoint paths.

**Сбои:** Compose разрешает относительные пути от нового base file; build context
`..`, Dockerfile, bind mounts, Caddy, env_file, file secrets и recovery overlays
могут начать смотреть в другой каталог. Проверить `--project-directory`, явный
`-p`, env-file lookup и Windows PowerShell twins. Не менять Compose project name,
external volume names или data mount targets: новый project name может выглядеть
как пустая БД. Принять один вариант разрешения путей и проверить всю overlay matrix.

**Приёмка:** `docker compose … config` всех поддерживаемых комбинаций без
производственных секретов; проверить реальные mounts/healthchecks/non-root,
hot reload, mail TLS, production image, backup/restore на disposable volumes,
existing-installation upgrade/recovery и graceful worker shutdown. Все команды
в OPERATIONS согласованы с новым расположением. Никакой реальной production
операции для проверки локального переноса.

Этап после Phase 2 (допустима отдельная инфраструктурная ветка работ после Phase 1,
если paths согласованы; интеграция всё равно последовательная).
**Восстановление:** старый config+image и тот же project/volume identity;
контроль доступности прежних данных; не удалять и не переименовывать volumes.
Откат кода не откатывает БД.

### `configs/` → `config/`; неподвижные каталоги

`configs/` отсутствует. Создавать пустую абстракцию не нужно. В Phase 3 отдельным
небольшим изменением оценить перенос `.env.example` в `config/env/`, затем обновить
все preflight/readFile/docs/ignore consumers и проверить env-template tests.
Реальные env/secret files не копируются. При сбое вернуть template и consumers
одним изменением; runtime env и данные не менять.

`scripts/`, `docs/`, `planning/`, `.github/` остаются на месте. Их строки путей
обновляются в том же этапе, что и соответствующий перенос. Для docs сохранить
anchors, стабильные decision ID и исторические SHA. Текущие runbook-команды
меняются только после фактической приёмки нового расположения.

## 5. Особая граница: Next standalone и runtime DB

Сегодня Docker build проверяет
`apps/web/.next/standalone/apps/web/server.js`, копирует standalone в `/app`,
static — в `/app/apps/web/.next/static`; entrypoint сначала мигрирует из
`/app/packages/db`, затем запускает app. DB отдельно упаковывается в `/runtime/db`
через pnpm deploy вместе с production dependency graph, tsx, SQL и workers.

При подготовке Phase 0 **ожидался**, но ещё не был доказан путь standalone с `site/server.js`.
В Phase 1 реальная Turbopack-сборка подтвердила этот путь (раздел 14).
Это гипотеза до реальной сборки. Нужно:

1. Собрать Next default compiler с repo tracing root и исследовать фактическое
   дерево `.next/standalone`/NFT (включая symlinks и runtime dependencies).
2. По измеренному дереву согласовать Docker assertions, COPY static и entrypoint.
   Проверить HTML, JS/CSS, изображения и route handlers в non-root runtime image.
3. На Phase 2 повторить для вложенных workspace packages; отдельно проверить
   `/runtime/db` и место его копирования в image. Checkout SQL не доказывает
   присутствие миграций в конечном образе.
4. Проверить tracing excludes относительно нового app directory: tests,
   scripts, docs, migrations/workers, secrets и generated output. Worker/migration
   файлы остаются доступны через независимый DB deploy, не через tracing app.
5. Сохранить compile-only placeholders, runtime config validation, origin/CSRF и
   same-digest promotion; проверить запуск одного digest с двумя test origins.

Phase 0 не запускал build/image и не подтверждает будущую standalone layout.
Fallback Webpack не подменяет обязательный default build gate.

## 6. Архитектурные и CI ограничения при переносе

Текущие определения инвариантов — [ARCHITECTURE](ARCHITECTURE.md#границы).
Их строгость сохраняется на каждой переходной структуре.

| Consumer                                        | Изменение в соответствующей фазе                                                                     | Негативная приёмка                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.dependency-cruiser.cjs`                       | CLI roots и from/to paths app/packages; сохранить parser/type edges и exclude только generated/tests | Domain→infra/app (value/type/re-export/import type query), UI→server, package src→app, cycle и unresolved import должны падать                       |
| `.dependency-cruiser.exceptions.cjs`            | Только перенос префиксов существующих exception paths; не расширять список                           | Новый route→db падает, известный health проходит; service-required долги остаются видимы                                                             |
| `scripts/ci-policy.mjs`                         | Сохранить старые+новые чувствительные пути в переходный период                                       | New-only и old-only paths, обе стороны rename (`--no-renames`), DB migrations/auth/storage/config/infra→full_acceptance; mixed docs не снижает scope |
| `.github/workflows/`                            | Path triggers, build file/context, commands, cache inputs                                            | Каждый trigger ловит переехавший код; exact SHA image cache не допускает чужой image; skipped required job даёт FAIL                                 |
| `knip.jsonc`                                    | Workspace `site`, вложенные packages и перенесённые tests, script entries                            | Рабочие dynamic entrypoints/worker fixtures найдены; нет глобального ignore для переноса                                                             |
| `vitest.config.ts`, `scripts/test-projects.mjs` | Aliases, DB marker, discovery, focused args                                                          | Mock edge/type-only semantics и unknown→database сохранены; `.next` копии исключены                                                                  |
| `tsconfig.json`, app tsconfig, workspace/lock   | Aliases и importer relative links на каждой границе                                                  | Frozen install и typecheck падают при испорченном workspace link                                                                                     |
| `biome.json`                                    | API overrides перемещены с маршрутами                                                                | Новый API route всё ещё попадает под noConsole                                                                                                       |

Негативные fixtures должны проверять фактический depcruise/CLI exit status, а не
только совпадение regex. В Phase 1 проверять `site/src` с корневыми packages;
в Phase 2 — `site/src` с `site/packages`, сохраняя проверки переходных путей до
исчезновения последних consumers. Запрещён `to: ^site/` для запрета app-import:
он ошибочно включает package→package. Source и destination чувствительного
rename дают одинаково строгий scope. Сейчас эти правила не перенастраивались.

## 7. Features: план Phase 4

`app/` сохраняет Next routing/layout/metadata, RSC composition и HTTP adapters:
request parsing, auth/origin, status/headers. Feature объединяет относящиеся к
одному сценарию UI, view models, hooks и прикладную оркестрацию, когда для этого
есть реальные файлы. Общие компоненты сайта (shell/nav/locale) остаются в
`src/components`, технические adapters — в `src/lib`; без универсальных
`utils/managers/common` для произвольной логики.

Services первоначально остаются на существующих местах. Перенос конкретного
service в `features/<name>/server/` — отдельная задача с обновлением consumers и
server/client boundary; не держать две реализации. Server modules используют
`server-only` по существующему подходу. Не создавать barrel, экспортирующий и
client UI, и DB/service код. Межfeature связи — через конкретный публичный
контракт, cross-feature orchestration остаётся явной; generic event bus не нужен.
DB repositories/workers остаются в DB package; domain — чистые правила и типы;
`@nexus/ui` — семантические primitives без продуктовой оркестрации и сервера.

| Feature       | Что группировать                                         | Какие границы сохранять                                                                         |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Resources     | resource detail/editor, builds, Q&A/reviews, view models | product/build services→repositories; storage/scanner и доступ повторно проверяются сервером     |
| Servers       | directory/detail, claims, observations view models       | master-list collection/SSRF limits и managed profile разделены                                  |
| Community     | publication/discussion compose, thread UI                | service commands, receipts, mute/follow и delivery transactions                                 |
| Library       | collection UI и selection state                          | library services/domain rules; batch transactions и session recheck в repositories              |
| Organizations | workspace/team/ownership UI                              | organization authz и audit atomicity                                                            |
| Moderation    | report/verification queues и decision forms              | role/current authority и repository transaction; private evidence не в client bundle            |
| Notifications | inbox/bell/preferences UI                                | admission/outbox/recovery workers остаются DB; secret keys не в UI                              |
| Accounts      | auth/security settings UI и view models                  | security package, HTTP origin/session, fresh authorization                                      |
| Support       | requester/staff cases и activity views                   | private support data, service/repository access и generic notices                               |
| Discovery     | search/filter/results composition                        | поисковый доступ/visibility в серверном запросе, а не фильтрация приватных результатов клиентом |

**Предложенный пилот:** узкая directory-поверхность Servers — `server-card` и
read-only directory view model; не переносить весь server lifecycle. Основание:
есть `site/src/components/server-card.test.tsx` и directory API/surface suites,
измеримая граница read-only UI и существующий directory-browser workflow.
Приёмка: URL/API, сортировка/фильтры, stale/empty/error, RU/EN, keyboard/mobile
сохранены; `pnpm test:directory`, depcruise, unit, directory browser. Внешний master
list не нужен в unit fixtures. После пилота оценить количество межfeature импортов
и читаемость и только затем поручать остальные модули. Новые business rules и
редизайн в этот перенос не включать. Откат — revert пилотного коммита.

## 8. Planning: проверенные расхождения и безопасные изменения

Гипотеза `layers.live.tasks`/`layers.history.tasks` **не подтверждена** на этом HEAD:
и schema, и JSON используют корневой `tasks`. Не вводится миграция формата.
83 задачи, 64 `done`, 19 `not_started`; суммы сформированы из фактических записей,
а не вручную. ID, статусы, baseline SHA и source register не изменены. В первом проходе frozen
файлы не менялись; последующее восстановление исходных байтов описано в разделе 13.

Пробел подтверждён: прежний `check_tracker.py` не загружал task-schema.json,
проверял лишь часть metadata/status/graph, и мог пропустить неправильные типы
полей/очереди. Теперь live contract проходит Draft 2020-12 JSON Schema до обхода
задач; проверяются уникальность ID, типы полей, enum, непустая acceptance,
повторные/несуществующие/self зависимости и циклы, включая conditional edges.
Схема уточняет типы реально используемых полей, не переименовывает backlog.
`dependency_notes` допускает пустую строку по действующим данным.

Validator использует Python `jsonschema` (уже установлен в этой среде); точная
повторяемая dev-only зависимость объявлена в `planning/tools/requirements.txt`.
Это обосновано необходимостью исполнять стандарт JSON Schema, а не писать
собственный неполный интерпретатор. Зависимости приложения/lockfile не меняются.

```bash
# На подготовленной Python-среде; при необходимости установить requirements в venv.
python -m pip install -r planning/tools/requirements.txt
python planning/tools/check_tracker.py --contract-only
python planning/tools/check_tracker.py
python planning/tools/test_tracker.py
```

`--contract-only` явно проверяет только live schema/DAG. Он не заменяет полный
исторический аудит и не является обходом его FAIL. Default команда сохраняет
проверки frozen manifest, source coverage и specification drift.

**Первый проход Phase 0: полный аудит FAIL, 10 сообщений до и после начальных правок:**

- byte size + SHA-256 frozen `tasks.json`, `task-schema.json`, `source-register.json`
  не совпадают с `planning/import-baseline/MANIFEST.json` (6 сообщений);
- specification drift относительно frozen: OPS-13/OPS-14 `verification`, UX-06 и
  GROW-08 `scope_files` (4 сообщения). Изменения содержательны, их нельзя просто
  стереть ради PASS; проверка сейчас запрещает любое такое отличие.

В первом проходе manifest не перехеширован, frozen история не переписана, живые
спецификации не откачены. На тот момент следующая отдельная задача: проверить Git происхождение этих изменений,
отличить форматирование от содержательного изменения, восстановить доказуемые
исходные bytes при наличии источника и определить контракт допустимой эволюции
spec. Любое исключение требует свидетельства; удалять проверки ради PASS нельзя.

**Производные документы.** Генератор `planning/tools/render_backlog.py` существует,
читает tasks + milestones + source-register и создаёт ROADMAP/TASKS/TRACEABILITY.
Добавлены `--output-dir` и `--check`: генерация во временный каталог и read-only
сравнение, с exit 1 при drift. Результат повторного рендера побайтно детерминирован;
тест подтверждает, что проверка drift не перезаписывает файлы.

```bash
python planning/tools/render_backlog.py --output-dir /tmp/nexus-backlog-review
python planning/tools/render_backlog.py --check
```

В первом проходе три документа не совпадали с сырым renderer output: ROADMAP и TRACEABILITY
имеют форматированные Markdown-таблицы, TASKS — отличие ведущего пробела. Проверка
должна показывать это, а не терять содержимое при автоматическом overwrite.
Большие документы не перегенерированы. Минимальный следующий шаг — определить
единое форматирование рендера, просмотреть полный diff во временном каталоге и
принять ровно проверенный результат; затем включить `--check` в planning gate.
В первом проходе CI не запускал Python tracker/render check. Продолжение задания
добавило обязательный gate в `plan`; детали и локальная проверка — в разделе 13.

Новые архитектурные task ID здесь не созданы: схема и baseline guard поддерживают
только DOC/OPS/FLOW/UX/GROW и фиксированные исходные 83 ID/order. Phase 0–6 —
разделы технического плана, не параллельные статусы. Если понадобятся новые карточки,
предложение: `ARCH-[0-9]{2}`, с одновременным изменением live schema/ID validator,
renderer/source coverage и политики добавления карточек без изменения frozen IDs.
Префикс не конфликтует с текущими task IDs; вводить его молча нельзя. Не путать
его с историческими decision/source `ARC*` и фазами backlog F0–F6.

## 9. Документационная архитектура

| Источник                      | Роль после переноса                                                             |
| ----------------------------- | ------------------------------------------------------------------------------- |
| README, AGENTS, docs/AGENT    | Краткий вход и ссылки; не копии всех технических правил                         |
| PROJECT-MAP                   | Фактические пути и быстрый поиск функции; ссылка на этот план до миграции       |
| ARCHITECTURE                  | Единственный основной контракт слоёв; обновление путей вместе с кодом           |
| OPERATIONS                    | Только принятые операторские команды и текущие recovery/secret markers          |
| Этот план                     | Целевая структура, последовательность, риски, критерии и локальные результаты   |
| DECISIONS + decision-baseline | Стабильные ID/статусы и исторические доказательства; не пересказ вместо реестра |
| PROBLEMS                      | Подтверждённые ограничения; ссылки на детали, без копии backlog                 |
| planning/tasks.json           | Единственный рабочий источник статусов                                          |
| ROADMAP/TASKS/TRACEABILITY    | Производные представления; согласованный renderer workflow                      |

Исторические GitHub SHA-ссылки и frozen `scope_files` остаются историей. Не заменять
их на новые пути или текущий SHA. Live навигация и operator commands изменяются
атомарно с этапом; после каждого этапа links + policy/operator consumers и ручная
проверка смысла. Не восстанавливать удалённые handbook файлы по старой ссылке:
проверить decision-baseline и DOCS-MIGRATION. Число сохранённых ссылок не доказывает
сохранение смысловых требований.

## 10. Последовательность оставшейся работы

| Шаг                 | Небольшой результат и зависимость                                                          | Критерий завершения                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Подготовка planning | Разобрать доказательства frozen drift и форматирование renderer отдельно от перемещений    | Полный audit и render check приняты без потери history/spec; Python gate воспроизводим     |
| Phase 1.1           | Обновить инвентарь на актуальном HEAD, подготовить отрицательные fixtures переходных путей | Нельзя пропустить API/db/auth/infra через rename; текущие правила остаются активны         |
| Phase 1.2           | Атомарный app→site с config/CI/Docker consumers                                            | Критерии Phase 1 выше, измеренная standalone layout, runtime smoke и strict CI             |
| Phase 2.1           | Packages→site/packages и DB/runtime consumers после Phase 1                                | Workspace graph, aliases, pnpm deploy/migrate/workers и отрицательные boundary tests       |
| Phase 2.2           | Tests→site/tests после 2.1 (или вместе при сильной связности)                              | Suite inventory/project membership сохранены, unit/DB/tooling не пропали                   |
| Phase 3.1           | Dockerfile/Compose/deploy→docker после Phase 2                                             | Полная overlay matrix и immutable volume/project identity, runtime/recovery acceptance     |
| Phase 3.2           | Оценить env template→config/env, убрать только подтверждённые старые consumers             | Template/preflight/ignore tests и актуальный runbook                                       |
| Phase 4.1           | Read-only Servers pilot после стабилизации путей                                           | Directory suites/browser, public URLs и server boundaries сохранены                        |
| Phase 4.2           | Остальные features отдельными предметными задачами после оценки пилота                     | Приёмка каждой области, без общей массовой замены и смешивания product changes             |
| Phase 5             | UI/DX улучшения существующей системы после сформулированных пользовательских критериев     | RU/EN, theme, mobile, keyboard, failures/retry и measured developer outcome                |
| Phase 6             | Итоговая документация и integrated acceptance после соответствующих этапов                 | Exact SHA полный релевантный CI, Docker dev/production build, DB/browser/recovery evidence |

Ни одна строка не означает выполненную карточку или разрешение deploy. На каждой
интеграционной границе проект обязан оставаться работоспособным; rollback каждого
этапа возвращает согласованную группу paths/config/consumers. При провале остановить
интеграцию следующего этапа, сохранить diff/evidence, вернуть собственный этап,
повторить прежние smoke. Не лечить отказ ослаблением проверок.

## 11. Проверки первого прохода Phase 0 (история)

Среда: Linux `/workspace/mta-nexus-site`, Python 3.12.14 / jsonschema 4.26.0,
Node 24.19.0 и pnpm 11.25.0. Последние отличаются от project pins; сообщения
Cursor Cloud в AGENTS о `/usr/local/bin` здесь не подтвердились. Все результаты
ниже — HEAD `948884b362687aa99c1425beb08a75cd4b0b89af` + локальный diff Phase 0.

| Команда                                                                                                                                             | Результат и предел доказательства                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git branch --show-current`, `git rev-parse HEAD`, `git status --porcelain=v1`                                                                      | `work`, указанный SHA; исходное дерево чистое                                                                                                                      |
| `python planning/tools/inventory_structure.py --output planning/structure-path-inventory.json`                                                      | PASS: индекс 1 353 файлов исходного Git snapshot                                                                                                                   |
| `python planning/tools/check_tracker.py --contract-only`                                                                                            | PASS: реальный JSON по уточнённой schema, IDs и полный dependency DAG                                                                                              |
| `python planning/tools/test_tracker.py`                                                                                                             | PASS: 17 tests, включая повреждённый JSON, обязательные поля, типы/статусы, duplicate/unknown/self/cycle/conditional dependencies и read-only deterministic render |
| `python planning/tools/check_tracker.py`                                                                                                            | FAIL: те же 10 существующих ошибок frozen/spec audit; новые live contract проверки PASS                                                                            |
| `python planning/tools/render_backlog.py --check`                                                                                                   | FAIL: существующее форматирование всех трёх views отличается от raw renderer; файлы не переписаны                                                                  |
| `python planning/tools/render_backlog.py --output-dir work/rendered`                                                                                | PASS: временный рендер, счётчики 83 = 64 + 19, 96 source rows; diff просмотрен                                                                                     |
| `node --test scripts/tests/architecture-analysis.node-test.mjs scripts/tests/ci-policy.node-test.mjs scripts/tests/ci-policy-renames.node-test.mjs` | PASS: 17 tests текущих boundary/type/cycle/API и CI/rename правил на Node 24                                                                                       |
| `node scripts/run-tooling-tests.mjs`                                                                                                                | PASS: 517 tests, 0 failed/skipped; прямой запуск на Node 24, не pinned acceptance                                                                                  |
| `pnpm docs:check`, `pnpm test:tooling`                                                                                                              | BLOCKED: ERR_PNPM_UNSUPPORTED_ENGINE (Node/pnpm ниже engines); engine guards сохранены                                                                             |

`node scripts/check-doc-links.mjs`: PASS, 396 local links/headings в 28 файлах.
`node node_modules/@biomejs/biome/bin/biome format planning/task-schema.json planning/structure-path-inventory.json`:
PASS, без исправлений. `git diff --check`: PASS. Live tasks, frozen snapshots и
три производных документа побайтно не менялись; это проверено Git diff.
Нормализация whitespace и table separator rows при сравнении временного рендера
подтвердила отсутствие содержательных отличий всех трёх views; строгий `--check`
по-прежнему показывает форматный drift, не маскирует его. `check:code`,
полные unit/DB, Next build, Docker image/Compose, browser и production проверки
не выполнялись: runtime код/paths не менялись, pinned среда отсутствует; перенос и
release readiness этими результатами не подтверждены. Первый проход Phase 0 выявил существующие
FAIL и сохранил их видимыми; результат продолжения приведён в разделе 13.

## 12. Границы следующего поручения

Изначальное поручение ограничивалось Phase 0; команда владельца «Продолжай автономно
по плану» разрешила последующие локальные этапы при сохранении интеграционных gates.
Она не разрешает production
deploy, реальные пользовательские данные, удаление Docker volumes, изменение
применённых SQL, переписывание Git history/force push, GitHub push/settings,
дополнительные worktree или платежи/DRM. Это границы текущего задания владельца,
а не новые требования подтверждать каждую обратимую локальную правку.

Для будущего безопасного переноса новых продуктовых решений сейчас не требуется.
Восстановление исторического baseline потребует выбора только если Git не даст
однозначного проверяемого исходника. Рекомендованное следующее поручение:
**отдельно поручить Phase 1.1: обновить inventory на принятом HEAD и подготовить
отрицательные fixtures переходных путей, до самого переноса приложения.**


## 13. Продолжение: восстановление planning audit и renderer

**Scope:** локальное восстановление проверяемости planning по команде «Продолжай»;
каталоги приложения и инфраструктуры не переносились. HEAD остался
`948884b362687aa99c1425beb08a75cd4b0b89af`, branch `work`; результаты относятся
к локальному совокупному diff, без нового коммита/push.

### Причины и исправления

Git подтвердил, что `b70f6dea4826905ab66ef34cb708606fc779fb08` отформатировал frozen
JSON, не меняя их смысл. Исходные bytes найдены в
`3b9fafe183fabad6504b3e5524a35c0c5ca56443`: все три размера и SHA-256 совпали с
неизменённым MANIFEST. Восстановлены именно эти bytes; перед записью проверено
семантическое равенство JSON. Три frozen JSON исключены только из форматирования Biome; lint и полный
manifest audit сохраняются. Это восстановление исторического доказательства, а не новый baseline.

Четыре specification drift соответствуют реальным коммитам: OPS-13/14 —
`45d59aff2b473f41b576d638b1ee94f8efa260db`, UX-06 —
`bb64d7cdcd9da8c636bf842264f2a968d9d49872`, GROW-08 —
`e5610f4aa91e685090785aacd119f7e66f17a6d4`. Значения live fields не менялись.
`planning/spec-amendments.json` хранит точные old/new digests, commit и причину.
Checker требует точного совпадения значений и подтверждения Git ancestor/commit;
неизвестное, повторное, устаревшее или не подтверждённое изменение даёт FAIL.
Это evidence registry без task execution state. Контракт поддержки — в
[TRACKER](../planning/TRACKER.md#frozen-baseline-и-изменения-спецификаций).

Генератор теперь применяет уже используемый проектом Biome через stdin, проверяя
его точную версию из package.json. Вывод всех трёх docs совпал с существующим
побайтно; документы не перегенерированы. Внешняя установка задаётся через
`NEXUS_BIOME_CLI` или `--biome-cli`. Все view форматируются до публикации;
каждый итоговый файл публикуется через atomic rename. Общей транзакции трёх файлов
нет: ошибка filesystem требует повторного запуска и `--check`.

В CI `plan` добавлены Python requirements, изолированная установка существующего
Biome той же версии из package.json и обязательные checker/tests/render check.
Workspace dependencies не устанавливаются ради planning; scope и прежние
code/full gates не ослаблены. `fetch-depth: 0` уже был настроен и сохранён для
проверки исторических commits. Изменение workflow само требует full acceptance;
такой удалённый прогон в этой сессии не выполнялся.

### Приёмка продолжения

Linux/Python 3.12.14, jsonschema 4.26.0, Node 24.19.0, Biome 2.6.4.
Node/pnpm по-прежнему ниже project engines; прямые Node-прогоны не являются
pinned acceptance. Точные результаты финальных checks приведены в ответе владельцу.

- Полный `python planning/tools/check_tracker.py`: PASS, 83 задачи, 64 done,
  19 not_started, frozen hashes и Git-evidenced amendments проверены.
- `python planning/tools/render_backlog.py --check`: PASS, без записи документов.
- `python planning/tools/test_tracker.py`: отрицательные проверки live schema,
  frozen bytes, неподтверждённых/повторных/stale amendments, недоступного Git
  evidence, formatter failure и детерминированности renderer.
- Рабочие tasks/source register/MANIFEST и три generated docs не менялись;
  восстановленные frozen bytes совпадают с исходным Git snapshot.

Финальные команды продолжения на том же HEAD с локальным diff:

| Команда                                                                                                                                    | Результат                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `python planning/tools/check_tracker.py`                                                                                                   | PASS, без проблем; frozen hashes и доказательства 4 amendments                                               |
| `python planning/tools/render_backlog.py --check`                                                                                          | PASS, все 3 документа совпадают побайтно                                                                     |
| `PYTHONDONTWRITEBYTECODE=1 python planning/tools/test_tracker.py`                                                                          | PASS, 31 tests                                                                                               |
| `node scripts/run-tooling-tests.mjs`                                                                                                       | PASS, 517 tests, без failures/skips                                                                          |
| `node --test scripts/tests/ci-hardening.node-test.mjs scripts/tests/ci-policy.node-test.mjs scripts/tests/ci-policy-renames.node-test.mjs` | PASS, 19 tests                                                                                               |
| `node node_modules/@biomejs/biome/bin/biome format .`                                                                                      | PASS, 3 386 файлов, без записи                                                                               |
| `node scripts/check-doc-links.mjs`                                                                                                         | PASS, 397 local links/headings в 28 файлах                                                                   |
| `git diff --check`                                                                                                                         | PASS                                                                                                         |
| Git byte comparison                                                                                                                        | PASS: три frozen файла равны исходному commit, live tasks/source register/MANIFEST/generated docs равны HEAD |
| Workflow YAML + embedded Python syntax                                                                                                     | PASS; удалённый Actions job не запускался                                                                    |

Перед Phase 1 остаётся pinned full CI для совокупного изменения workflow/tooling.
Локальный PASS audit/render не подтверждает build, DB, Docker, browser или deploy.

## 14. Автономное продолжение: Phase 1 — приложение в site

**Область:** текущий checkout `work`, исходный HEAD
`948884b362687aa99c1425beb08a75cd4b0b89af` + совокупный локальный diff.
Коммит, push и deploy не выполнялись. Прежние изменения Phase 0 сохранены.
Перед переносом сохранён source snapshot; он используется для проверки состава
файлов и возможности вернуть только собственное изменение путей.

### Toolchain и предварительная проверка

Node 26.10.0 скачан с nodejs.org в рабочий каталог; SHA-256 архива сверён с
официальным SHASUMS256.txt. pnpm 12.4.2 установлен изолированно. Все pnpm-проверки
этого этапа запускаются с PATH на эти версии; системные профили не менялись.
Начальный `pnpm install --frozen-lockfile` прошёл.

Первый полный code gate выявил один ранее не проверенный дефект Phase 0:
закрытый список документов в `tests/mainline-repository-policy.test.ts` не включал
новый основной план. Добавлена только точная строка STRUCTURE-REFACTORING.md;
контроль полного состава docs и остальных правил сохранён. Остальные 8 246 unit
проверок того прогона прошли. Focused-проверка исправленного policy suite: 5 PASS.

### Переходные ограничения до переноса

В dependency-cruiser одновременно покрываются старое приложение, `site` с
корневыми пакетами и `site` с вложенными пакетами. Пакеты не могут импортировать
приложение; `site/packages` не ошибочно считается приложением. Domain/UI/API/DB
границы, unresolved imports, type edges и циклы сохраняют error severity.
Исключения HTTP→DB получили только второй префикс пути, без новых маршрутов.

`scripts/tests/architecture-migration.node-test.mjs` создаёт реальные import
fixtures трёх layout и запускает depcruise JSON + failing CLI gate. Проверяются
нарушения domain→infra/app, UI→server, package→app, API→DB вне списка, циклы и
unresolved imports; известный health и package→domain разрешены.

CI sensitivity сопоставляет старые и новые пути с прежними правилами. Обе стороны
rename сохраняют scope через существующий `--no-renames`; отдельно проверены
новые sensitive paths, смешивание с docs и запрет скрыть sensitive source в docs.
Legacy fixtures сохраняются намеренно. Добавленные Node suites довели tooling
набор с 517 до 523 tests; переходный focused-набор: 9 PASS.

### Фактическая структура после переноса

```text
site/                   # прежний apps/web, имя @nexus/web сохранено
  src/{app,components,lib}/
  scripts/
  next.config.mjs
  package.json
  tsconfig.json
packages/               # пока в корне, Phase 2 не начата
tests/                  # пока в корне, Phase 2 не начата
Dockerfile              # пока в корне
compose*.yaml           # пока в корне
deploy/                 # Caddyfile и image pins пока здесь
```

Обновлены web importer и относительные workspace links в multi-document
pnpm-lock.yaml, workspace globs, app aliases, Next tracing root/excludes, Knip,
Biome API override, корневые команды, Compose source mount, Docker assertions/COPY,
production entrypoint, browser/operator scripts, CI path filters и активные test
imports/readFile fixtures. Frozen planning, task specifications, source register
и исторические SHA-ссылки не преобразовывались.

YAML-сравнение lockfile до/после подтвердило: изменены только web importer и его
относительные links; версии и остальные данные совпадают. Frozen install после
переноса прошёл. Относительные имена всех app-файлов сохранены: route tree и URL
не переименовывались. Из 1 395 перемещённых исходных файлов содержимое поменялось
у 21: конфигурации, operational import и относительные test/helper paths, а также
путь в dev diagnostics. Это описание охвата, не критерий готовности.

Vitest classification до/после сопоставлена по каждому имени suite с единственным
преобразованием app prefix: **1 132 unit и 252 database файла**, membership совпал.
Typecheck, Knip и depcruise проходят; последний проверил 1 660 модулей и 6 893 edges.

### Реальная standalone-сборка

Default Next/Turbopack build прошёл внутри production-shaped image. Из-за CA
управляемого Cloud proxy использована временная копия Dockerfile с secret-mounted
публичным CA bundle только в сетевых RUN. TLS не отключался; приложение, compile
placeholders, build command и runtime COPY/entrypoint не подменялись. Это локальная
адаптация проверки к среде, не результат удалённого CI с неизменённым Dockerfile.

Собран образ `nexus-phase1-verify:948884b3`, image ID
`sha256:d5bc7a77a1193a7ef53e610cf61e2e6b8b13e1bb57f0d85f3e709d751d6894bb`.
Tag содержит базовый HEAD, но payload включает локальный diff и не является
release evidence чистого коммита.

Из конечного образа проверены `/app/site/server.js`, `.next/BUILD_ID`, static tree,
90 SQL migrations, migrate/worker entrypoints, tsx и UID 1000. Старого `/app/apps/web`
нет. Искомая layout теперь подтверждена реальной сборкой, а не предположением.

Compose dev config подтвердил read-only bind `site/src` → `/app/site/src` и polling.
Production и production-CI overlays отрендерены с явными синтетическими значениями
через `--env-file /dev/null`; ни один production stack не запускался. Hosted-only
guards infrastructure/browser harnesses сохранены.

### Дальнейшая приёмка этой границы

После переноса полный unit-прогон выявил один stale assertion: tracing suite ещё
ожидал глубину `../../`. Ожидания изменены на реальную `../`; focused tracing +
repository policy: 8 PASS. Финальный code gate выполняется после остальных проверок.

Database-прогон использует отдельный PostgreSQL 18 container, loopback port,
уникальную сеть и tmpfs storage; миграции применены только там. Прежние
`nexus-local` containers, volumes и пользовательские данные не используются.
Runtime/browser/итоговые результаты фиксируются после завершения проверок.
Phase 2 не начинается до приёмки этой интеграционной границы.

### Runtime и dev smoke

Локальный HTTP readiness конечного image прошёл: database reachable, storage
read/write и атомарная публикация без замены существующего ключа. Anonymous browser
smoke в Chromium проверил `/`, `/market`, `/servers`, `/auth/login`, отсутствие JS
ошибок и пропавших static assets, реальную гидратацию, переключение light/dark,
RU/EN и мобильную ширину без horizontal overflow. Это HTTP smoke на loopback,
не hosted TLS/auth/directory acceptance. Directory API вернул 503 в первом runtime fixture; причина не установлена
как внешний fetch. Проверка публичных страниц не выдавалась за приёмку внешнего
MTA provider или всего directory journey.

Один image ID запущен с двумя разными runtime APP_URL. Для каждого допустимый
Origin дошёл до validation error 400, чужой получил CSRF 403. Валидная регистрация
не отправлялась. Runtime fixture использует отдельную чистую БД и предусмотренный
production контракт TRUSTED_PROXY_SECRET; секреты и build placeholders приложения
не менялись.

Конечный app payload также проверен на отсутствие исходных test/spec и `.env`
файлов. DB payload проверен отдельно: наличие 90 SQL, tsx и worker/migrate entries.

Development image построен отдельно. Через read-only bind `site/src` наблюдалась
автоматическая смена временного CSS probe alpha→beta→отсутствие probe после
восстановления исходника, без ручной перезагрузки. Перед редактированием smoke ждёт
гидратацию и HMR WebSocket: чтение SSR CSS само по себе не означает готовность
клиентского HMR. Использован разрешённый localhost origin; guard allowedDevOrigins
не расширялся. Native filesystem event через bind и WebSocket 101 проверены отдельно.
CSS восстановлен побайтно. Уточнена документация: Turbopack здесь использует native
filesystem events; WATCHPACK_POLLING сохраняется для Webpack. Все созданные app/dev
containers удалены до итоговых code/DB-прогонов; старый nexus-local stack не тронут.

### Обращение с неуспешными DB-прогонами

Первый полный DB-прогон не выдал итогового отчёта и перестал продвигаться; он был
остановлен, его результат не считается PASS. Повтор с verbose reporter показал
таймауты source-worker и late-expiry suites. Во время этих запусков выполнялись
дополнительные Docker container inspections/smoke, что могло повлиять на ресурсные
условия; точная причинность этим совпадением не доказана. Второй прогон остановлен
с exit 130 и также не считается PASS. Таймауты/проверки не увеличивались и не
отключались; production business logic не менялась ради результата.

После завершения Docker-операций два проблемных файла отдельно прошли на ещё одной
чистой disposable DB: **5 tests, exit 0**, без дополнительных Docker запусков во
время тестов. Это не замена полной DB-приёмки: итоговый полный набор должен пройти
отдельно и последовательно после code gate. Никакие следующие переносы не выполняются
на основании лишь focused PASS.


Финальный `pnpm check:code` на pinned toolchain завершён с **exit 0**:
format/lint/typecheck, 1 132 unit files / 8 247 tests, 523 tooling tests, Knip,
depcruise (1 660 modules / 6 893 edges). Результат относится к локальному diff,
не к удалённому CI и не к release candidate. После этого выполняется отдельный
полный DB-прогон на ещё одной свежей disposable DB, без параллельных Docker,
browser, unit или build операций.

### Итог локальной приёмки Phase 1

Итоговый изолированный DB-прогон завершён с **exit 0**: **252 файла, 1 151 тест,
0 failed, 0 skipped**. JSON reporter: success=true; набор имён файлов совпал со
всем database membership, сохранённым до/после переноса. Применялись исходные
таймауты; Docker/container операции во время этого прогона не выполнялись.
Ранние прерванные/неуспешные попытки не подменяются этим результатом и остаются
описаны выше.

| Проверка                                                                 | Результат на базовом HEAD 948884b3 + локальном diff                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` до/после                                | PASS, 9 workspace projects, версии зависимостей сохранены                                     |
| `pnpm check:code` (Node 26.10.0 / pnpm 12.4.2)                           | PASS, exit 0; 8 247 unit + 523 tooling tests, format/lint/typecheck/Knip/depcruise            |
| `pnpm test:database --reporter=verbose --reporter=json --outputFile=...` | PASS, exit 0; 252 файла / 1 151 тест, JSON report verified                                    |
| Default Turbopack production-shaped image build                          | PASS; Cloud CA adaptation описана выше, standalone layout измерена                            |
| Runtime readiness и same-image two-origin checks                         | PASS; HTTP/DB/storage atomicity, canonical Origin 400 vs чужой 403                            |
| Anonymous Chromium и dev HMR smoke                                       | PASS; 4 страницы, assets/JS/theme/locale/mobile; CSS alpha→beta→restored через read-only bind |
| Compose config и shell syntax                                            | PASS; dev mount/polling flag, production overlays, start/operator scripts                     |
| `python planning/tools/test_tracker.py`                                  | PASS, 31 tests на pinned Node для formatter subprocesses                                      |
| `python planning/tools/check_tracker.py`                                 | PASS, frozen bytes/IDs/dependencies/source coverage/Git amendments                            |
| `python planning/tools/render_backlog.py --check`                        | PASS, без перезаписи views                                                                    |
| `node scripts/check-doc-links.mjs`, `git diff --check`                   | PASS; 397 links/headings в 28 файлах, whitespace без ошибок                                   |

Live tasks, source register, MANIFEST и ROADMAP/TASKS/TRACEABILITY побайтно равны
исходному HEAD; frozen files соответствуют исходным manifest hashes. Применённые
SQL не изменялись. Пробный CSS удалён с побайтным восстановлением оригинала.
Созданные app/dev/DB containers и отдельная сеть убраны адресно; Docker volumes не
удалялись. Исходный nexus-local stack не останавливался. Собранные локальные images
остаются доступны для review; это не опубликованные release artifacts.

**Открытая интеграционная граница:** полный hosted CI на новом коммите/PR ещё не
выполнялся. Его требуют изменения workflow, Dockerfile/lockfile и repository policy.
Локальный PASS не выдаётся за hosted TLS/auth/directory/resource/recovery acceptance
или production готовность. До этой приёмки перенос packages/tests (Phase 2) не
начинается. Для отправки ветки и draft PR необходимо прямое разрешение владельца
согласно пункту 4 корневого AGENTS; автономная локальная работа не отменяет эту границу.
