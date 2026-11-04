# Проверенный срез проекта

**Дата:** 4 ноября 2026. **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **Каноническая ветка:** `main`. **Версия приложения:** `1.2.0-beta.3` (не поднималась этой волной).

## Текущая интеграционная волна — ожидает CI на опубликованном exact SHA

Локально проверенная цепочка поверх `41330d89a607ea501d2868f73355136c01d742ae` (включая docs handoff `4e3b1214`):

- `70e372f2` — development seed и historical seed отказываются работать без явного acknowledgement и против production-конфигурации;
- `739723af` — восстановлены historical-seed проверки и зелёный локальный code gate;
- `3f32b3d6` — общий `PageHeader` применён к публичным каталогам серверов, статей и Discover;
- `6cbe787e` — общий `SearchField` применён к публичному поиску, публикациям и каталогу MTA-серверов;
- `54c6b674` — общий `ErrorState` отделяет сбой загрузки от подтверждённого empty state и держит retry рядом;
- `d235ba9b` — общий GET-only `FilterBar` сохраняет URL-backed фильтры и search-landmark семантику;
- resource mobile primary + shell a11y restore (эта ветка): footer legal links wrap at 320px RU; inbox pagination landmark ≠ center title; `/market/[slug]` acquisition aside precedes deep content in DOM (`lg:order` keeps desktop sticky two-column).

Локально на этой ветке: focused acquisition/footer/notification suites, `pnpm lint` / `format:check` / `typecheck`, production `next build` (123 страницы), browser measure 320 RU без overflow и mobile/desktop order на live bind-mounted app. Tip `4e3b1214` resource-browser красный из‑за footer overflow + duplicate Notification center nav; auth-browser timeouts на том SHA считать отдельно. Не переносить verified green со старого commit.

## Verified green baseline (bullets)

- **Tip SHA:** `98d245f0279669d8fe549af082514e4dd82c033e` (`fix(web): focus review fields and record the green tip`).
- **Verified CI green on that tip:** [CI 41508863990](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41508863990) (lint/unit/db/image + production browser smoke selected).
- **Prior selected green:** `8163c0c5…` / [CI 41507032591](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41507032591).
- **Prior selected green:** `748df327…` / [CI 41503267385](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41503267385).
- **Prior selected green:** `359faea8…` / [CI 41485628226](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41485628226).
- **Prior selected green:** `bed43fc1…` / [CI 41484238459](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41484238459).
- **Prior selected green:** `9e1245ab…` / [CI 41480166414](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41480166414).
- **Failed tip (not baseline):** `cb76dbba…` production smoke sign-out without confirm dialog (fixed on `d444db71`); `3cf4d33e…` soft-refresh unit mocks; `2519b7a4…` inbox aria-busy + batch typecheck; `cb065352…` server-review useRouter mock / unused ReactElement / format; `6324ea0e…` GuestAuthLinks blast; `b7a8dd10…` displayName/community-report slots.
- **Prior full selected-scope green (incl. resource-browser):** `0a034c84…` / [CI 41399812125](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41399812125).
- **Failed tip (not baseline):** `7cd137da…` format; `4565dd8f…` compare base; `c32a4ef6…` admin guest unit contracts (fixed on `e7892ceb`).
- **Earlier full selected green:** `a27e55a5…` / [CI 41394529674](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41394529674).
- **Failed tip (not baseline):** `53badf5a…` / [CI 41395863320](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41395863320) — resource-browser RU claim-button focus flake (fixed by focus poll on `0a034c84`).
- PASS только на exact SHA; green CI ≠ deploy.
- **Guest-return wave (tip series):** `PlatformSignIn`/`authEntryHref` first-paint `next=`, commerce/server gates, statistics login, AuthForm initial return path, QA/follow first-paint.
- **Honesty/a11y wave (tip series):** clear-filter CTAs (support/discussion/publication target/inbox), confirmAction on destructive clients, honest loading shells across public directories and workspace hubs, filter `focus-visible` outlines, market/main overflow clip, connect-controls clipboard a11y, community filtered-report reset, neutral root loading shell.
- **Auth chrome:** full shell kept on `/auth` (theme + banner); logout redirects to bare `/auth/login`.
- **Open free beta copy (tip series):** public/legal/support/commerce surfaces say open free beta (not closed beta); paid features stay disabled; support SLA disclaimer matches product terms.
- **Publication readiness:** summary transaction allows FOR SHARE (no longer `accessMode: read only`).
- **Author browser acceptance:** admin build moderation sends FLOW-22 `currentPassword`; mark-all and retire confirm dialogs covered.

## Оценка стадии

Рабочая формулировка: **кандидат бесплатной beta с незакрытой продуктовой и эксплуатационной приёмкой**. Оценка по коду и проверкам на зафиксированном tip SHA; **не** утверждение о production readiness.

## Старт для следующего агента

1. Только **`main`**: `git checkout main && git pull --ff-only` → чистый `git status`. Зафиксируйте exact SHA и сначала проверьте GitHub CI именно для него. Если новый tip красный, восстановление обязательного gate имеет приоритет над новой UI-работой. Читайте [AGENT.md](AGENT.md), этот файл, [PROBLEMS.md](PROBLEMS.md), `planning/tasks.json` (**64** `done` / **19** `not_started` по `python3 scripts/_agent_list_open_tasks.py`). Markdown backlog — только через `python planning/tools/render_backlog.py`.
2. Локальный scratch (`scripts/_agent_*`, `.dsh-ops/`) в `.gitignore` и не должен появляться в коммитах. Не ведите параллельные handoff-журналы.
3. Defaults владельца A/B — [DECISIONS.md](DECISIONS.md) (FLOW-05/06/12, UX-06/14/17/23, OPS-19, GROW-01). Ads/commerce/GROW пилоты не активированы.
4. Schema tip (SQL в repo): **`0089_resource_qa`** (также `0088_follow_mute_and_notify_comments`). Миграции forward-only; не гонять `pnpm db:generate` на живой БД (OPS-06).
5. HTTP→service для новых write/составных путей; object-mute → `followWorkspaceService` / id prefix `omi`.
6. Push / GitHub settings / production deploy / платежи — только по прямому указанию владельца.
7. Следующий разрешённый продуктовый результат — **Admin primary journey** (reports/resources/verification hubs beyond support queue). Support (list/create → open case; staff queue; messages; honest empty|error + overflow clip; form vs list errors separated) уходит отдельным PR. После merge: один сценарий Admin hub → open queue/detail или honest empty/error; mobile; RU/EN.
8. Приёмка: focused admin suites + typecheck/lint/build; browser evidence только на exact SHA. Сначала CI tip после merge — красный tip важнее новой UI-работы.
9. Дальше: Admin → operational gates **OPS-09…20**, ads **UX-24–26**, пилоты **GROW-02…09** без активации.

На baseline tip закрыты кодовые разрывы аудита (см. [PROBLEMS.md](PROBLEMS.md)): F01/F02/F05/F06/F08/F09/F10(усиление)/UI01/INT13(idempotency)/ARC14(authoring) + связанные FLOW/UX/OPS/GROW-01 и **UX-19** (gallery lightbox), **UX-20** (version help), **UX-22** (publication readiness). TypeScript-блокеры интеграции на `main` сняты. **Не** закрыты **F03/F04** (operational gates) и human/deploy gates beta-кандидата.

**Последний GitHub-verified baseline:** `98d245f0…` / [CI 41508863990](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41508863990). Текущая опубликованная интеграционная волна перечислена выше и не становится verified tip до зелёного CI на её exact SHA. Не закрывать F03/F04, GitHub settings, deploy, рекламу и GROW-пилоты без отдельного допуска.

## Свидетельства и ограничения

- **Исходники:** DOC + P1/P2 в `main`; verified tip `98d245f0…` selected green; last full selected `0a034c84…`. Не значит tip = production.
- **CI:** см. bullets в **Verified green baseline** выше. Более ранние прогоны — только по exact SHA (пример TS failures: [41285198461](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41285198461)).
- **Upgrade/restore:** retained disposable artifacts базы = PASS. Не production backup practice.
- **GitHub:** public; main protection на проверке базы отсутствовала. Не менять settings без поручения.
- **Tracker:** 64 done / 19 open (OPS external/github_settings, GROW pilots, ads UX-24–26). `done` ≠ production enablement.
- **Архитектура:** `pnpm analyze:architecture` PASS на baseline-волне. Не заменяет unit/database/full_acceptance.

## Приоритетные остатки

**Operational gates:** F03 (alert routing), F04 (backup/recovery contract), OPS live/github_settings. **Product:** GROW пилоты, ads **UX-24–26**. Перед следующим DDL — disposable generate rehearsal. После нужных human gates — `pnpm beta:fetch` / `pnpm beta:candidate` на **exact tip SHA** (см. [PROBLEMS.md](PROBLEMS.md)).

## Версии и инфраструктура

Node `26.10.0`, pnpm `12.4.2`; Docker `node:26-alpine`. PostgreSQL 18. См. [OPERATIONS.md](OPERATIONS.md), [RELEASE-PLAN.md](RELEASE-PLAN.md).

## Как обновлять этот файл

После значимой интеграции: tip `main`, доказательства CI/acceptance, открытые gates. История в Git.

**Источники:** [AGENT.md](AGENT.md), [PROBLEMS.md](PROBLEMS.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md), `planning/tasks.json`, [AGENTS.md](../AGENTS.md).
