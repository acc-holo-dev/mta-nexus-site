# Проверенный срез проекта

**Дата:** 2 ноября 2026. **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **Каноническая ветка:** `main`. **Версия приложения:** `1.2.0-beta.3` (не поднималась этой волной).

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

1. Только **`main`**: `git checkout main && git pull` → чистый `git status` (локальные WIP не путать с tip). Читайте [AGENT.md](AGENT.md), этот файл, [PROBLEMS.md](PROBLEMS.md), `planning/tasks.json` (**64** `done` / **19** `not_started` по `python3 scripts/_agent_list_open_tasks.py`). Markdown backlog — только через `python planning/tools/render_backlog.py`.
2. Локальный scratch (`scripts/_agent_*`, `.dsh-ops/`) в `.gitignore` и не должен появляться в коммитах. Не ведите параллельные handoff-журналы.
3. Defaults владельца A/B — [DECISIONS.md](DECISIONS.md) (FLOW-05/06/12, UX-06/14/17/23, OPS-19, GROW-01). Ads/commerce/GROW пилоты не активированы.
4. Schema tip (SQL в repo): **`0089_resource_qa`** (также `0088_follow_mute_and_notify_comments`). Миграции forward-only; не гонять `pnpm db:generate` на живой БД (OPS-06).
5. HTTP→service для новых write/составных путей; object-mute → `followWorkspaceService` / id prefix `omi`.
6. Push / GitHub settings / production deploy / платежи — только по прямому указанию владельца.
7. Очередь: **OPS-09…20** (external/github_settings и live gates), **UX-24–26** (ads proposals), **GROW-02…09** (пилоты). **UX-06/19/20/22** в tracker `done` — не открывать ads/commerce без нового поручения.

На baseline tip закрыты кодовые разрывы аудита (см. [PROBLEMS.md](PROBLEMS.md)): F01/F02/F05/F06/F08/F09/F10(усиление)/UI01/INT13(idempotency)/ARC14(authoring) + связанные FLOW/UX/OPS/GROW-01 и **UX-19** (gallery lightbox), **UX-20** (version help), **UX-22** (publication readiness). TypeScript-блокеры интеграции на `main` сняты. **Не** закрыты **F03/F04** (operational gates) и human/deploy gates beta-кандидата.

**Последняя локальная волна:** verified green — `98d245f0…` / [CI 41508863990](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41508863990) (статус обращения, библиотека и поддержка в оболочке, честный Q&A, фокус полей отзыва). Коммиты после этого SHA (подтверждение снятия реакции и остановки уведомлений о версиях, подвал по сессии, ошибки темы и черновик обращения из публикации) ещё не являются verified tip. Не закрывать F03/F04, GitHub settings, deploy, рекламу и GROW-пилоты без отдельного допуска.

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
