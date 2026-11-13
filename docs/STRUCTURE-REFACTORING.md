# NEXUS: план архитектурного рефакторинга

**Направление принято владельцем.** Phase 0 — foundation; затем разрешено автономное
локальное продолжение. Phase 1 проверена: `apps/web` → `site`. По следующему поручению
выполняется Phase 2.1: `packages` → `site/packages`. Владелец явно
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
приложение и пакеты находятся в `site`; tests и инфраструктура остаются
на прежних местах до отдельных этапов.

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
и canonical tracker не меняют содержания. Tests остаются в корне; их перенос — Phase 2.2.
