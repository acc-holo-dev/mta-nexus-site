# NEXUS: план архитектурного рефакторинга

**Направление принято владельцем.** Phase 0 — foundation; затем разрешено автономное
локальное продолжение. Phase 1 проверена: `apps/web` → `site`. По следующему поручению
Phase 2.1 проверена: `packages` → `site/packages`.
Phase 2.2 проверена: `tests` → `site/tests`.
Phase 3 проверена: `deploy/configs` → `docker/config`.
Phase 4.1 проверена: read-only Servers pilot.
Phase 4.2 проверена: read-only Resources catalog.
Phase 4.3 проверена: Resources detail server composition.
Phase 4.4 проверена: Resources versions/reviews server composition.
Phase 4.5 проверена: Resources media/evidence presentation.
Phase 4.6 проверена: Resources reviews/Q&A UI.
Phase 4.7 проверена: Resources review и Q&A forms.
Phase 4.8 проверена: Resources dependency и version-help UI.
Phase 4.9 проверена: Resources download UI.
Phase 4.10 проверена: Resources release-watch UI.
Phase 4.11 проверена: Resources media editor и server composition.
Phase 4.12 проверена: Resources build screen и controls.
Phase 4.13 проверена: Resources build moderation controls.
Phase 4.14 проверена: Resources author management UI.
Phase 4.15 проверена: Resources publisher workspace views.
Phase 4.16 проверена: Resources creation и copying UI.
Phase 4.17 проверена: Resources lifecycle и moderation UI.
Phase 4.18 проверена: Resources package, requirements и quarantine UI.
Phase 4.19 проверена: Resources reports и batch watches.
Выполняется Phase 4.20: Resources cart и delivery presentation. Владелец явно
разрешил отдельную ветку и draft PR для полного CI. Merge, production deploy,
реальные данные, удаление volumes, переписывание Git history, GitHub settings и
активация commerce/DRM этим разрешением не покрываются.

**База интеграции:** `7f6773b3cd88df2d9ecb963cbd46cce97a87c1d9` (`origin/main`),
13 ноября 2026. Предыдущая локальная работа начиналась на `948884b3`; она сохранена
в checkpoint `aaa0ecba1fac66c6c96c330773a880b1630dc4f9`. Проверки того checkpoint
не объявляются PASS объединённой версии. При подготовке PR обнаружено отставание
checkout; новые возможности main и его реорганизация сохранены при интеграции.

Это основной технический план, не второй tracker. Обязательные правила слоёв —
[ARCHITECTURE](ARCHITECTURE.md), выполнение — [AGENT](AGENT.md), операторские команды —
[OPERATIONS](OPERATIONS.md). Статусы карточек — только `planning/tasks.json`.

## 1. Проверенное исходное состояние main

| Место на базовом SHA                            | Ответственность                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web/src/app`                              | Next routing/layout/RSC/metadata и HTTP adapters                    |
| `apps/web/src/lib/services`                     | Сценарии и оркестрация, service-команды                             |
| `apps/web/src/components`, `lib`                | UI продукта, locale, view models, технические adapters              |
| `apps/web/scripts`                              | Observation capture и discussion replay                             |
| `packages/domain`                               | Чистые типы, ошибки, правила и события                              |
| `packages/validation`                           | Входные схемы и общие ограничения                                   |
| `packages/security`                             | Сессии, authz, идентификаторы, лимиты                               |
| `packages/storage`                              | Приватные артефакты и целостность                                   |
| `packages/config`                               | Программная проверка env, не каталог templates                      |
| `packages/ui`                                   | Собственная UI-система без server dependencies                      |
| `packages/db`                                   | Schema, repositories, forward-only SQL, workers и upgrade guards    |
| `tests/unit`, `tests/database`, `tests/helpers` | Уже разделены на main; классификацию проектов всё ещё проверяет код |
| `deploy/`                                       | Dockerfile, все Compose overlays, Caddyfile, image pins             |
| `configs/env/.env.example`                      | Env template уже перенесён на main                                  |
| `scripts`, `.github`                            | Автоматизация, policy/Node/browser tests, Actions                   |
| `docs`, `planning`                              | Контракты, canonical layered tracker и frozen evidence              |

Main также содержит UX-24/25/26 (advertising lifecycle, renderer и opt-out за
выключенными по умолчанию флагами), новый SQL `0090` и его release-upgrade target,
новые правила навигации/docs. Они сохранены, не включались этим рефакторингом.
Pinned host toolchain: Node 26.11.1 и pnpm 12.4.2; Next 16.4.4, React 19.3.1,
TypeScript 7, Vitest 5, PostgreSQL 18/Drizzle. SWC и отдельный TypeScript 6 для
cruiser type edges остаются по существующему packageExtensions.

Workspace declarations:

```text
web        → config, db, domain, security, storage, ui, validation
db         → config, domain, security, validation
storage    → config, domain
security   → domain
validation → domain
config/ui/domain → нет внутренних workspace dependencies
```

Это package declarations; фактические imports/cycles проверяются depcruise.

## 2. Инвентарь путей

Полный индекс файлов и строк исходного main:
[structure-path-inventory.json](../planning/structure-path-inventory.json).
Его воспроизводит `planning/tools/inventory_structure.py --revision <SHA> --output <temp>`.
Учитываются literal/escaped paths, quoted path segments, fixtures, regex, scripts,
workflows, Docker/Compose и документация. Historical snapshots отделены от активных
consumers; это не инструкция на глобальную замену.

```bash
python planning/tools/inventory_structure.py --revision 7f6773b3cd88df2d9ecb963cbd46cce97a87c1d9 --output /tmp/nexus-paths.json
rg -n --hidden -g '!.git/**' -g '!**/node_modules/**' -g '!**/.next/**' 'apps/web|packages/|tests/|deploy/|configs/' .
rg -n 'apps.{0,4}web|packages|tests|deploy|configs' scripts .github deploy
```

Динамические `path.join(root, "packages", ...)`, DB client marker в
`scripts/test-projects.mjs`, tooling discovery, relative imports и `readFileSync`
проверяются отдельно чтением контекста. Исторические SHA URLs и frozen paths не
переписываются. Перед каждым этапом повторять inventory на его новой базе.

## 3. Целевая структура

```text
site/
  src/{app,features,components,lib}/
  packages/{ui,domain,db,security,validation,storage,config}/
  tests/{unit,database,helpers}/
  next.config.mjs
  package.json
  tsconfig.json
docker/                 # Dockerfile, Compose overlays, Caddyfile, image pins
config/env/             # templates, без реальных секретов
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

`@nexus/*` сохраняются. Корневые конфиги остаются, где нужны инструментам.
`site/packages/config` и `config/env` имеют разные обязанности. На текущей границе
приложение, пакеты и tests находятся в `site`; инфраструктура — в `docker`,
шаблоны окружения — в `config/env`.

## 4. Migration Map и интеграционные границы

| Этап         | Перенос                                   | Consumers и основные риски                                                                                                                                                               | Приёмка и восстановление                                                                                                                                                                                             |
| ------------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1      | `apps/web` → `site`                       | workspace/importer links, TS aliases, tracing root/globs, Knip, Biome API override, depcruise/exceptions, scripts/fixtures, CI filters, deploy Dockerfile/Compose, production entrypoint | Frozen install, check:code, exact suite membership, DB, default build/image/runtime/browser/dev HMR и full CI. Revert согласованного изменения, не отдельные reverse substitutions; данные/volumes не затрагивать    |
| Phase 2.1    | `packages` → `site/packages`              | workspace globs/links, root+app TS, Vitest aliases, Knip, depcruise CLI/from/to, Tailwind UI scanning, DB marker, tooling discovery, deploy graph, workers/migrate/seed/upgrade scripts  | Сохранены package names, graph, tests; pnpm deploy содержит SQL/tsx/entrypoints; disposable migration/upgrade/worker и code/CI gates. Revert целого этапа + прежний image, не SQL rollback                           |
| Phase 2.2    | `tests` → `site/tests`                    | Сохранить уже существующие unit/database/helpers; imports/mocks, explicit suite commands, focused/isolated/PowerShell runners, browser fixtures, policy regex                            | Ни один suite не потерян и не ушёл из DB в unit ошибочно. Сравнить имена/membership и негативные fixtures; отдельный подэтап возможен при зелёной границе. Rollback всего подэтапа                                   |
| Phase 3      | `deploy` → `docker`; `configs` → `config` | Все overlays и Caddy, Docker context/file, относительные mounts/env/secrets, image pins, scripts/doctor/CI/OPERATIONS и `.dockerignore`                                                  | Compose matrix/config, non-root/health/worker shutdown, local HMR, production image, disposable backup/recovery/upgrade. Сохранить project/volume identity; вернуть config+image без удаления/переименования volumes |
| Без переноса | scripts/docs/planning/.github             | Активные path consumers меняются атомарно с владельцем пути; historical references не механически                                                                                        | Links + operator/policy tests + ручная проверка смысла                                                                                                                                                               |

Порядок: Phase 1 → packages → tests → infrastructure. Packages/tests допустимо
объединить, если их consumers невозможно безопасно развести, но не оставлять
промежуточный неработающий workspace. Каждый следующий перенос ждёт приёмки
предыдущей границы. При сбое сохранить diff/evidence и вернуть только свой этап.

### Переходные TS/Next пути

После app→site пакеты пока корневые: app aliases `../packages/*`, tracing root `../`.
После Phase 2 aliases становятся `./packages/*`. Не переключать root aliases на
несуществующие директории заранее. Workspace frozen install проверяется на каждой
границе. Импорты внутри app сохраняют смысл, выходящие к helpers/scripts теряют
один уровень `../`. Raw readFile/regex fixtures — отдельные consumers.

### Standalone и DB payload

На прежней базе фактическая default Turbopack-сборка подтвердила
`site/.next/standalone/site/server.js`; static копируются в `/app/site/.next/static`,
entrypoint сначала мигрирует из `/app/packages/db`, затем запускает `/app/site/server.js`.
Это не доказательство нового объединённого SHA: CI должен пересобрать его.

DB независимо упаковывается `pnpm --filter @nexus/db --prod deploy /runtime/db`;
наличие SQL в checkout не заменяет проверку финального payload. На Phase 2 повторно
исследовать standalone/NFT tree и deploy graph, проверить symlinks, modules, static,
SQL/tsx/workers, отсутствие test/env/git/docs в app payload и non-root startup.
Не предполагать неизменность output layout после вложения packages.

Compile placeholders, runtime config validation, storage mounts, CSRF и same-image
promotion между origin сохраняются. Webpack fallback не заменяет default build gate.
Cloud CA для сетевых build RUN монтируется как secret; TLS не отключать и CA не
включать в image. Это адаптация проверки среды, не изменение продуктовых границ.

## 5. CI и архитектурные ограничения

| Consumer                  | Изменение вместе с путями                                       | Негативная приёмка                                                                                                 |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `.dependency-cruiser.cjs` | Старые+новые from/to, CLI roots, type edges, прежние exclusions | Domain→infra/app (value/type/re-export/type query), UI→server, package→app, cycle, unresolved import должны падать |
| Exceptions                | Только префиксы путей, без новых HTTP exceptions                | Известный health разрешён, новый API→DB запрещён; service-required долги не скрыты                                 |
| `scripts/ci-policy.mjs`   | Сопоставление старых/новых sensitive paths, обе стороны rename  | Auth/config/storage/migrations/workers/infra и sensitive test→full; docs/mixed/unknown не сужают gate              |
| Workflows                 | Filters, build context/file, commands/cache paths               | Новые пути запускают прежние jobs; skipped/missing job не даёт acceptance                                          |
| Knip/TS/workspace         | Реальные aliases/workspaces/entrypoints                         | Нет blanket ignore; frozen links и types корректны                                                                 |
| Vitest/classifier         | Discovery, DB marker, mocks/type edges, generated excludes      | Имена и project membership до/после, unknown→DB, `.next` не исполняется                                            |
| Biome                     | API overrides с маршрутами                                      | noConsole и другие правила сохраняются                                                                             |

Нельзя запрещать package→app через `to: ^site/`: это включает будущие packages.
Текущие переходные правила исключают `site/packages` из app scope. Новые реальные
fixture layouts проверяют legacy, app moved и nested packages через depcruise CLI.
Старые regex/CI sensitivity остаются для source стороны rename (`--no-renames`).
Изменения чувствительного кода не маскируются под docs-only.

## 6. Features (Phase 4)

`app` остаётся Next composition/routing/metadata и HTTP adapter: parse/auth/origin,
status/headers. Feature группирует конкретный продуктовый UI, view models/hooks и
прикладной scenario code. Общие shell/navigation/locale — в components; технические
adapters — в lib; не создавать universal managers/utils ради структуры.
Services первоначально остаются существующими: перенос одного service — отдельный
шаг, без второй реализации. Server/client entrypoints разделены; server-only и
сессионные проверки сохраняются. DB repositories/workers остаются в DB package,
pure rules/types — в domain, primitives — в UI. Межfeature связи — явные контракты.

| Область       | Что группировать / что сохранять                                                            |
| ------------- | ------------------------------------------------------------------------------------------- |
| Resources     | detail/editor/build/Q&A/review UI; service→repository, scan/access/atomic delivery          |
| Servers       | directory/card/detail/claim view models; master observations отдельно от managed profile    |
| Community     | publication/thread/compose; receipts, follow/mute и delivery transactions                   |
| Library       | collection/selection UI; batch authority, fresh session и repository locks                  |
| Organizations | team/ownership/workspace; authz/audit атомарны                                              |
| Moderation    | report/verification queues; staff role и private evidence на сервере                        |
| Notifications | inbox/bell/preferences; admission/outbox/recovery workers не в UI                           |
| Accounts      | auth/security settings; security package, current session и origin                          |
| Support       | requester/staff cases; private data и generic notices                                       |
| Discovery     | search/filter composition; visibility в server query, не клиентская фильтрация private rows |

Пилот — узкий read-only Servers directory/card, не весь server lifecycle.
Проверки: актуальный `test:directory`, UI/API behavior, stale/empty/error, RU/EN,
keyboard/mobile и directory browser. Public URLs и business rules сохраняются.
После пилота оценить cross-feature imports и читаемость, затем расширять по областям.
Rollback — revert пилота; редизайн/новые features не смешиваются с переносом.

## 7. Planning foundation на действующей базе

На `7f6773b3` гипотеза поручения подтверждена: schema требовала root tasks, данные
уже используют live/history. Схема исправлена под реальный формат. 83 ID, task
содержимое, статусы, source register и historical baseline сохранены. Count слоя
равен числу записей; общий execution counter вычисляется: 65 done + 18 not_started.
Недавно завершённая карточка live не переносится автоматически в history.

Восстановлены удалённые checker/generator. Проверяются schema/types/enums/required,
layer counts, уникальные IDs и межслойный DAG с conditional edges. Исторический
аудит проверяет frozen manifest и точные Git-evidenced specification amendments;
это evidence без статусов, не tracker. Три frozen JSON восстановлены по исходным
bytes из `3b9fafe1`, совпадающим с неизменённым MANIFEST; только их formatter выключен.

Временный render review сохранил все 83 карточки и historical links; TASKS diff
исправляет устаревшие поля по актуальному JSON, ROADMAP — counter/живую очередь,
TRACEABILITY воспроизведён без изменений. Нет нового неподдерживаемого ID prefix.
Команды, зависимости и policy — в [TRACKER](../planning/TRACKER.md).

## 8. Документация и следующие этапы

README/AGENTS/AGENT остаются кратким входом. PROJECT-MAP описывает реальные пути,
ARCHITECTURE — правила, OPERATIONS — принятые команды, DECISIONS и decision-baseline —
стабильные IDs/доказательства, PROBLEMS — подтверждённые ограничения. Этот план хранит
цель/миграцию/риски, а статусы — только JSON. Нельзя переписывать historical SHA URLs
на новые пути; operator markers меняются только с проверенным потребителем.

- Phase 0: layered schema/audit/render, inventory, стратегия gates и migration map.
- Phase 1: согласованный app→site + локальные checks и full hosted CI.
- Phase 2: packages/tests по отдельным интеграционным границам (таблица выше).
- Phase 3: deploy/configs→docker/config с Compose/recovery acceptance.
- Phase 4: Servers pilot, затем предметные модули по подтверждённым границам.
- Phase 5: UI/DX по отдельным пользовательским критериям, без замены своей UI-системы.
- Phase 6: финальные docs + exact-SHA code/DB/image/browser/local/production-shaped
  Compose/recovery acceptance. Локальный PASS не доказывает production routing,
  доставку провайдеру, schedule backup или разрешение deploy.

## 9. Проверки и граница публикации

На checkpoint старой базы проходили 8 247 unit, 523 tooling, 1 151 DB tests,
planning negatives, default build/image/runtime/anonymous browser/HMR. Эти результаты
исторические: актуальный main добавил функции/SQL и новые пути. Их нельзя переносить
на интеграционный commit без повторных проверок.

Новая версия использует Node 26.11.1/pnpm 12.4.2. Полный hosted CI запрашивается на
отдельной ветке и draft PR по разрешению владельца; результаты должны быть привязаны
к head SHA. Phase 1 прошла полный [CI #4629](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43369295244)
на head `db136afc`: 8 271 unit, 524 tooling, 1 155 DB tests и все browser/Compose gates.
Phase 2.1 продолжена по поручению владельца в том же draft PR; её результат требует
нового полного CI на новом SHA. Production и GitHub settings остаются вне scope.

### Phase 2.1: граница пакетов

Workspace — `site` + `site/packages/*`; package names и dependency versions сохраняются.
Прежние importer keys и web links в lockfile меняются без нового разрешения зависимостей.
TS aliases и Vitest DB marker используют вложенные пакеты; `site/tsconfig.json`
исключает `packages` из автоматического include, сохраняя проверку импортированных
модулей. Корневой typecheck продолжает проверять исходники пакетов.

Next tracing root остаётся корнем репозитория: standalone entry — `/app/site/server.js`.
Отдельный production DB payload разворачивается в `/app/site/packages/db`, включая SQL,
tsx и worker entrypoints; все Compose working_dir и operator scripts используют этот путь.
Исторические fixtures проверяют обе структуры; архитектурные ограничения не ослабляются.

Состав до/после переноса сверяется по именам после единственного mapping `packages/` →
`site/packages/`: 1 135 unit-файлов, 253 DB-файла, 69 tooling suites. SQL, package manifests
и canonical tracker не меняют содержания. Эта граница прошла полный
[CI #4630](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43372084200)
на `d1a0c34a`: 8 271 unit, 525 tooling и 1 155 DB tests, все browser/Compose gates.

### Phase 2.2: граница тестов

`tests/{unit,database,helpers}` → `site/tests/{unit,database,helpers}` без смены
классификации и assertion contracts. Проверка до/после сохраняет все 1 135 unit-файлов,
253 DB-файла и 69 tooling suites после единственного mapping `tests/` → `site/tests/`.
Колокированные тесты приложения и пакетов остаются на своих местах.

Imports/mocks и helper paths пересчитаны от владельца файла; worker tests сохраняют
корневой cwd. Grouped/focused/isolated runners, Compose binds и workflow filters используют
новые пути. CI sensitivity по-прежнему распознаёт обе стороны rename. Knip учитывает
tests в workspace `site`; Next исключает их из автоматического TS include и standalone
tracing. Tailwind исключает `site/tests` из автоматического source scan, сохраняя
production CSS без новых utility classes из fixtures. Корневой typecheck и Vitest
продолжают проверять все тесты.

Отрицательные fixtures проверяют, что `site/.next/standalone/site/tests` не исполняется,
а чувствительные `site/tests/unit` требуют полного CI. Текущая граница требует нового
полного прогона на своём SHA; предыдущий PASS не переносится автоматически.

После переноса tests Knip обнаружил неиспользуемую корневую devDependency
`lucide-react`: tests принадлежат `site`, где библиотека уже объявлена. Удалено
только корневое дублирование и его importer link; версии в site/UI и lockfile
resolutions сохраняются. Ignore для этого случая не добавляется.

### Phase 3: инфраструктурные пути

Phase 2 прошла полный [CI #4634](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43375361978)
на `7862cb60`: все 15 обязательных jobs, 8 271 unit, 525 tooling и 1 155 DB tests.
`deploy` → `docker`, `configs` → `config`; Caddyfile и env template сохраняются
побайтно, image digests/platform/status — без изменений (обновлён только self-path
в инструкции pin file). Все script/CI/doctor/operator consumers переходят атомарно.
Dependabot Docker ecosystem смотрит в `/docker`; CI sensitivity покрывает оба
имени infrastructure/config directories и обе стороны rename.

До/после сравниваются 11 rendered Compose scenarios: service settings, env,
secret bindings, volumes/networks и default project остаются прежними. Обнаруженные
старые production/verify `context: .` и `./deploy/Caddyfile` разрешались относительно
YAML в неверные пути. Теперь context — `..`, Dockerfile — `docker/Dockerfile`,
Caddy bind — `./Caddyfile`; реальные файлы проверяются, а не только строки config.

`name: deploy` в трёх base files сохраняет историческую default identity;
CLI `-p` и `COMPOSE_PROJECT_NAME` имеют прежний приоритет. Для старого ignored
`deploy/.env` preflight исключает молчаливый возврат к defaults. Инструкция по
сохранению env и абсолютным host-secret paths — [OPERATIONS](OPERATIONS.md#infrastructure-directory-migration).
Данные, project names существующих установок и volumes не переименовываются.

Приёмка этапа требует нового полного CI, включая image/startup/browser,
upgrade, persistence и backup/restore; предыдущие PASS не заменяют новый SHA.

Dev-browser CI также проверяет HMR через read-only bind `site/src`: CSS probe
alpha → beta → исходный CSS. Восстановление выполняется в finally и проверяется
`git diff`; hosted guards сохраняются.

### Phase 4.1: Servers read-only pilot

Phase 3 прошла полный [CI #4635](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43379958936)
на `17ddc793`: все 15 gates, 8 271 unit, 528 tooling и 1 155 DB tests, новый HMR
и startup/persistence/backup/browser acceptance.

Публичный каталог, две карточки и четыре чистые model modules группируются в
`site/src/features/servers`. Server composition страницы также принадлежит feature;
App Router остаётся тонким adapter без новых URLs. Public ports — `client`, `server`,
`model`; server entry использует Next `server-only`. Полные implementation contracts
— в [feature README](../site/src/features/servers/README.md).

Services и их cache остаются на прежних местах. Чистый MTA type больше не импортируется
клиентом/model из service module. API использует pure model entry и прежний service,
сохраняя validation/status/headers/freshness. Raw observation и managed profile не
сливаются; claim/management/reviews/collector code не переносится.

Новые error rules закрывают private imports извне feature, feature→routing,
client→server/services/infra, model→UI/app и Node core imports. Negative fixtures
проверяют реальные value/type edges; реальный client/model dependency closure
проверяется отдельно. CI sensitivity не маскирует feature под старые UI-only paths:
изменения Servers pilot требуют полного контура, включая directory browser.

`test:directory` исправляет прежний несуществующий aggregate service test на четыре
реальные parse/transport/observations/endpoints suites; добавлены существующие pure
model и directory UI suites. Полный состав unit/database до/после сохраняется после
единственного rename `server-card.test.tsx`. Критерии — behavior/API/cache/error/zero/
stale/RU/EN и browser keyboard/mobile, без redesign или новых business rules.

### Phase 4.2: Resources read-only catalog

Servers pilot прошёл полный [CI #4636](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43394838095)
на `517f0a5f`: все 15 gates, 8 271 unit, 530 tooling и 1 155 DB tests,
все 11 directory browser scenarios и production/upgrade/persistence/HMR acceptance.

Каталог `/market`, карточка ресурса и чистый query/pagination module выделены в
`site/src/features/resources`; [локальный контракт](../site/src/features/resources/README.md)
описывает `view`, `server` и `model`. Общий view entry сохраняет совместимость с RSC
и Discovery без нового client directive. App Router сохраняет dynamic
config и делегирует server-only composition; products API использует pure model.

Services, repositories, visibility/scan/access policy и SQL остаются прежними.
Detail/editor/builds/download/Q&A/reviews не переносятся. Home, Discovery и страницы
автора/организации используют общий публичный view; fallback preview остаётся общим
компонентом. Тела карточки, query и страницы сохраняются, меняются imports/exports.

Новые error rules и negative fixtures закрывают private imports, feature→routing,
view/model→server/services/infra и impure model edges; реальное transitive closure
проверяется отдельно. Feature paths требуют full acceptance. Состав unit/database
сохраняется после rename colocated card test. Критерии — каталог/SQL/HTTP/pagination,
preview/card/consumers, RU/EN, empty/error и полный browser publishing/download flow.

### Phase 4.3: Resources detail server composition

Resources catalog прошёл полный [CI #4638](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43401017128)
на `9697188d`: все 15 gates, 8 271 unit, 532 tooling и 1 155 DB tests,
production image/startup/upgrade/persistence/backup и browser journeys.

Composition `/market/[slug]` перенесена в Resources private `server/detail-page.tsx`.
Отдельный public `detail-server.ts` защищён `server-only` и не расширяет граф
каталожного `server.ts`. App Router сохраняет прежние generateMetadata и dynamic
config, делегируя только page composition. URLs/loading сохраняются.

Helpers, async calls и render body перенесены без изменения; metadata body остаётся
побайтно прежним. Session, visibility, management/entitlement, build provenance,
gallery, Save/mute/watch и Q&A/reviews используют существующие реализации.
Services/SQL, HTTP claim/download, detail client components, editor и workers не
переносятся. Read-only SSR composition не подменяет server download authority.

Architecture guards включают новый public entry, его server isolation и negative
value/type fixtures. Реальные graphs каталога/detail проверяются независимо;
view/model остаются свободны от server dependencies. Behavior tests продолжают
входить через App Router; source-reading guards следуют за реализацией. Состав
unit/database suite сохраняется. Критерии — metadata safety, manager/private/public,
loading/error, RU/EN acquisition/download integrity и полный CI/browser.

### Phase 4.4: Resources versions/reviews server composition

Detail composition прошла полный [CI #4639](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43403779984)
на `d9716522`: все 15 gates, 8 271 unit, 533 tooling и 1 155 DB tests,
включая production image/startup/upgrade/persistence/backup и browser journeys.

Публичные страницы `/market/[slug]/versions` и `/market/[slug]/reviews` передают
SSR composition в Resources `server/versions-page.tsx` и `server/reviews-page.tsx`.
Новые точные public entries — `versions-server.ts` и `reviews-server.ts`, оба
защищены `server-only`. Metadata/dynamic config и loading остаются в App Router.

Тела helpers/async operations/render сохранены после named export adaptation;
imports пересчитаны относительно feature. Public visibility, trusted-clean SQL,
manager/entitlement affordance, pinned buildId, noindex/nofollow, reviews pagination,
legacy evidence и guest/auth return paths не меняются. Services/SQL и HTTP download/
review mutations сохраняются; client components и private workspace не переносятся.

Architecture guards расширены только двумя public server entries. Negative fixtures
проверяют private imports и value/type leaks новых entries; реальные графы всех
четырёх Resources server compositions проверяются на взаимную независимость.
Состав unit/database tests сохраняется без rename; behavior tests входят через
прежние App Router routes. Критерии — public release/review UI, SQL integration,
review lifecycle, pinned download, metadata и полный CI/browser acceptance.

### Phase 4.5: Resources media/evidence presentation

Versions/reviews composition прошли полный [CI #4640](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43406823905)
на `df0eab11`: все 15 gates, 8 271 unit, 533 tooling и 1 155 DB tests,
включая production/upgrade/persistence/backup и browser journeys.

Preview, gallery/lightbox и build provenance/package evidence UI перенесены в
Resources private components. Public `client.ts` сохраняет client directives
preview/gallery; нейтральный `evidence.ts` сохраняет RSC/client compatibility.
Card/detail/versions внутри feature используют прямые imports; media/build/library
workspace — public ports. Common native-dialog hook и locale/URL/message adapters
остаются на прежних местах; новых UI primitives или сетевых collectors нет.

Чистые gallery interaction и build provenance helpers перенесены побайтно в model;
публичные helpers доступны через model entry. Тела пяти UI modules сохранены после
пересчёта imports. Legacy/unknown/scan error/signature и package truncated/missing
states, decode fallback, modifier links, keyboard/focus и bounded arrows не меняются.
Evidence UI не авторизует выдачу: SQL/service/HTTP download checks сохраняются.

Architecture guards покрывают новые public ports и их value/type server leaks;
real transitive closure проверяет client/evidence/view/model. Четыре server graph
по-прежнему независимы. Source-reading guards следуют за private implementation;
состав unit/database tests сохраняется после rename preview test. Критерии —
preview/gallery/provenance/package behavior, workspace/detail/versions consumers,
package/media SQL integrations и полный CI/browser acceptance.

### Phase 4.6: Resources reviews/Q&A UI

Media/evidence прошли [CI #4642](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43412833391) на `e2050afc`. Список отзывов и Q&A panel объединены в Resources через `reviews-view` и `client`; общие формы, HTTP adapters, services и repositories остаются прежними. Public и workspace consumers используют явные порты, серверная авторизация и подтверждения сохраняются. Architecture suite проверяет транзитивные client/view зависимости и запрет server leaks.

### Phase 4.7: Resources review и Q&A forms

Reviews/Q&A UI прошли полный [CI #4643](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43488216449) на `9bef8629`. Review editor/report/decision и Q&A report form перенесены в Resources. `review-controls` сохраняет client boundary для library и moderation; feature использует private forms напрямую. ConfirmAction, HTTP adapters, services, repositories и серверная проверка прав не меняются. Тела компонентов сохранены после адаптации imports; client graph и negative fixtures защищают server boundary.

### Phase 4.8: Resources dependency и version-help UI

Review/Q&A forms прошли полный [CI #4644](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43491191721) на `8e6e0e4c`. Dependency/reverse-dependency lists, variants и version-help UI объединены в Resources; workspace использует `detail-view`. Shared resolution helpers, copy/support components, services и server visibility сохраняются. Тела компонентов сохранены после адаптации imports. Boundary fixtures проверяют public port и реальный transitive graph.

### Phase 4.9: Resources download UI

Dependency/version-help UI прошли полный [CI #4645](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43496622259) на `87b01a88`. Кнопка скачивания объединена в Resources через отдельный client port; detail и versions используют private implementation, library consumers — public port. Клиентский fetch adapter, hash/size/pin/cancellation, HTTP/service authorization и audit остаются прежними. Тело компонента сохранено после адаптации imports. Boundary fixtures проверяют client/server isolation и реальный transitive graph; `test:resource-integrity` следует за перенесённым colocated test.

### Phase 4.10: Resources release-watch UI

Download UI прошёл полный [CI #4646](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43513489988) на `0981698d`. Release-watch control перенесён в Resources с отдельным client port для library; detail использует private implementation. Тело компонента сохранено после адаптации imports. ConfirmAction, request adapter, service, repository и outbox остаются прежними; revision/retry, подавление уведомлений и server authority сохраняются. Boundary fixtures проверяют новый port и реальный transitive graph.

### Phase 4.11: Resources media editor и server composition

Release-watch UI прошёл полный [CI #4647](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43532217845) на `f01ae576`. Media editor и screen объединены в Resources; workspace и admin routes используют server-only `media-server`, сохраняя metadata и оболочки. Тела screen/editor сохранены после адаптации imports. Session/role/ownership, scan и mutation authority остаются в service/repository и HTTP handlers; confirm, abort и retry не меняются. Неиспользуемый public export preview удалён: preview остаётся private внутри feature. Negative fixtures и реальные client/server graphs проверяют границы нового порта.

### Phase 4.12: Resources build screen и controls

Media editor прошёл полный [CI #4649](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43535148309) на `dffbd868`. Build screen и client controls объединены в Resources; workspace и admin routes используют server-only `build-server`, сохраняя metadata и оболочки. Тела screen/controls сохранены после адаптации imports. Session/role/ownership, scan provenance, revision, confirm и server mutation authority остаются прежними. Services, repositories и moderation controls не переносятся. Negative fixtures и реальные client/server graphs проверяют новый порт.

### Phase 4.13: Resources build moderation controls

Build screen прошёл полный [CI #4650](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43537128520) на `0e22dde2`. Moderation controls перенесены внутрь Resources как private client component; тело сохранено после адаптации imports. Подтверждение, revision и проверка trusted-clean scan сохраняются; shared helpers, HTTP handlers, service и repository остаются прежними. Реальный client graph и boundary fixtures проверяют изоляцию.

### Phase 4.14: Resources author management UI

Build moderation controls прошли полный [CI #4651](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43539435074) на `b9f9545f`. Формы совместимости и вариантов и ссылка поддержки версий объединены в Resources. Workspace routes используют отдельные client ports; тела компонентов сохранены после адаптации imports. Actor/draft/revision guards, подтверждения, HTTP adapters и server authority остаются прежними. Negative fixtures и реальные client graphs проверяют новые границы.

### Phase 4.15: Resources publisher workspace views

Author management UI прошёл полный [CI #4652](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43542338801) на `4eb502ac`. Фильтры авторского списка, панель готовности и навигация ресурса объединены в Resources. Серверные представления используют `publisher-view`, клиентская навигация — отдельный `publisher-navigation`. Тела компонентов сохранены после адаптации imports; локализация, ссылки, состояния готовности и server authority остаются прежними. Negative fixtures и реальные графы проверяют новые границы.

### Phase 4.16: Resources creation и copying UI

Publisher workspace views прошли полный [CI #4653](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43546546740) на `ad322b5a`. Форма создания, экран успеха, форма копирования и представление метаданных объединены в Resources. Client ports отделены от RSC-compatible copy view. Тела компонентов сохранены после адаптации imports; actor/draft/intent, file validation, confirmation, HTTP/service authority и обработка неопределённого результата остаются прежними. Colocated test и команды следуют переносу; границы и project membership проверяются.

### Phase 4.17: Resources lifecycle и moderation UI

Creation и copying UI прошли полный [CI #4654](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43548380213) на `07821cc3`. Авторские формы, lifecycle controls и staff moderation controls объединены в Resources через отдельные client ports. Тела компонентов сохранены после адаптации imports; draft/actor/revision, подтверждения, scan/support context и server authority остаются прежними. Colocated test и project membership проверяются; negative fixtures и реальные client graphs защищают границы.

### Phase 4.18: Resources package, requirements и quarantine UI

Lifecycle и moderation UI прошли полный [CI #4655](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43550607960) на `6e2b8a43`. Экраны состава сборки и требований, представление отчёта и quarantine controls объединены в Resources. Изолированные server-only ports отделены от view и client port; тела сохранены после адаптации imports. Session/role/access, scan, opt-in уведомлений и server authority не меняются. Boundary fixtures и реальные графы проверяют новые границы.

### Phase 4.19: Resources reports и batch watches

Package, requirements и quarantine UI прошли полный [CI #4656](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43552563068) на `b6596b36`. Экран жалоб на отзывы, staff Q&A report actions и batch release watches объединены в Resources; server-only и client ports разделены. Тела компонентов сохранены после адаптации imports. Session/role, confirmation, revision, quota, abort/retry и server authority остаются прежними. Boundary fixtures и реальные графы проверяют новые границы.

### Phase 4.20: Resources cart и delivery presentation

Reports и batch watches прошли полный [CI #4657](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43560109382) на `9d34745c`. Controls корзины, её review evidence и server-only представление квитанции выдачи объединены в Resources с раздельными ports. Тела компонентов сохранены после адаптации imports. Commerce остаётся выключенным по прежней политике; подтверждения, guest intent, доступ к выдаче, services и repositories сохраняются. Boundary fixtures и реальные графы проверяют новые границы.
