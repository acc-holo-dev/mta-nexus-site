# Проверенный срез проекта

**Дата сверки:** 15 ноября 2026. **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **Каноническая ветка:** `main`. **Версия приложения:** `1.2.0-beta.3`.

На момент сверки `origin/main` указывает на `7f6773b3cd88df2d9ecb963cbd46cce97a87c1d9`.
Изменения структуры в этой копии находятся в [draft PR #1176](https://github.com/acc-holo-dev/mta-nexus-site/pull/1176), не в `main`.
Фактические пути ветки описывает [карта проекта](PROJECT-MAP.md); её текущий head
и результаты CI нужно проверять непосредственно в PR. Наличие draft не означает merge или deploy.

## Исторический снимок main на 10 ноября

- **Тогдашний `origin/main` tip:** `7c4b2fdf` — merge PR #1174 (`feat/ux26-adoptout-contract`, UX-26 часть A: opt-out-предпочтение + честный контракт измерений). Основной перенос `16cbe9de`: секция UX-26 в `docs/UX-CONTRACT.md`, settings-секция Advertising preferences с cookie `nexus_ad_opt_out` (in/out, SameSite=Lax) только за флагом `advertisingLifecycleEnabled` (выключен, рендер не активен), unit-тесты `ad-preference`. Telemetry/hide-report/единицы измерений остаются контрактом без кода.
- **Verified-green head:** `16cbe9de` (head PR #1174), merge-gate `CI result` = `success` — [CI 42887634450](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/42887634450): `Lint, types and parallel unit tests` / `Sequential database tests` / `Build production image once` green; browser smokes требовали production Docker/workflow gates. Пост-merge CI на `7c4b2fdf` (run 42889586338) повторно прогонялся на main.
- **Предыдущий tip/merge:** PR #1168 (`ab76f359`, `chore/dehardcode-build-size`, CI 42794049567); PR #1167 (`f6c16aa0`, `chore/reconcile-release-readiness-policy`, CI 42790103208); PR #1163 (`9662378b`) — fix Local Docker startup gate.

## Оценка стадии

Рабочая формулировка: **кандидат бесплатной beta с незакрытой продуктовой и эксплуатационной приёмкой**. Оценка по коду и проверкам на зафиксированном tip SHA; **не** production readiness.

## Продуктовые и инженерные факты исторического снимка

- Core free-beta journeys (auth return, library acquire/download honesty, inbox filters, release watch, discussion intent, Home personal changes, resource Q&A) реализованы локально.
- Resource Q&A + platform abuse loop: member report UI на product/server/user; staff inbox deep link `reportId` + content moderationHref; reporter status notice → `/workspace/platform-reports`; discovery/follow mute hydration. Schema tip — `0089_resource_qa` (+ `0088`).
- Collection release-posture loop: inventory / collection releases / library updates project watch state + follow-latest/open; collection watches page has per-item toggle (membership still does not auto-enroll watches).
- Servers/orgs trust-staff: verification queue deep link `verificationId` + focused card; server claim/proof enrichment; ownership resolve notice → managed server; server report `moderationHref` → workspace claim status.
- Support staff notices deep-link to `/admin/support/:caseId` (queue list remains fallback for unsafe ids).
- Build-incident downloader notices open library versions/updates (not Security Center), with RU/EN localization via `data.kind = build_incident`.
- Publisher build honesty: review/quarantine/restore notices deep-link to `/workspace/resources/:productId/builds/:buildId` with RU/EN `build_lifecycle` copy (no malware invention).
- Community discussion honesty: author removal notices → `/workspace/discussions/:commentId`; staff comment report targets expose `moderationHref` → `/admin/community/:contentId/discussion/:commentId`.
- Article discussion follow/mute: public article SSR hydrates content follow + mute into ContentFollowControls (same honesty as discovery/product Save).
- Verification requester resolution (non-server) → `/workspace/verification/:requestId` (history list remains unsafe-id fallback); server resolve stays on the managed server.
- Public entity follow/mute: server / user / developer / organization profiles SSR-hydrate FollowButton initial (same honesty as discovery/product Save).
- Organization access notices: structured `data.kind = organization_access` with org name; stored/push copy no longer embeds raw org ids (legacy regex path retained).
- Publication activity and reaction notices: structured `publication_activity` / `content_reaction` data with titles; stored/push copy no longer embeds raw content ids (legacy regex path retained).
- Support requester notices: structured `data.kind = support_requester` with case subject; stored/push copy no longer embeds raw case ids (legacy regex path retained).
- CI: main больше не отменяет in-flight full_acceptance; docs-only tip push не форсирует full scope.
- Open free beta copy на public/legal/support/commerce; paid surfaces остаются disabled.
- Auth chrome: full shell на `/auth`; logout → `/auth/login`.

## Старт для следующего агента

1. Проверьте `git status`, текущую ветку и HEAD, сохраните незакоммиченные изменения. Не переключайте ветку и не создавайте worktree вопреки поручению владельца. Читайте [AGENT.md](AGENT.md), [PROBLEMS.md](PROBLEMS.md), `planning/tasks.json`; Markdown backlog (`docs/ROADMAP.md`, `docs/TASKS.md`, `docs/TRACEABILITY.md`) — производные представления. Проверки и их результаты привязывайте к точному SHA.
2. Scratch (`scripts/_agent_*`, `.dsh-ops/`) в `.gitignore`. Не вести параллельные handoff-журналы.
3. Defaults владельца — [DECISIONS.md](DECISIONS.md). Ads/commerce/GROW пилоты не активированы. **ErrorState residual / tip-honesty micro-PRs — не приоритет**, пока владелец не вернёт эту очередь.
4. В текущем checkout последний migration и release-upgrade target — **`0090_ad_placement_lifecycle`**. Миграции forward-only; не запускайте `pnpm db:generate` на живой БД. Q&A fixtures — `db:seed:historical`, не baseline seed.
5. HTTP→service для новых write/составных путей.
6. Push / GitHub settings / production deploy / платежи — только по прямому указанию владельца.
7. Live drills **F03/F04** и **OPS-09/11** — только с допуском и evidence целевой среды.

В историческом снимке закрыты кодовые разрывы аудита (см. [PROBLEMS.md](PROBLEMS.md)): F01/F02/F05/F06/F08/F09/F10(усиление)/UI01/INT13/ARC14 + FLOW/UX/OPS/GROW-01 и UX-19/20/22. **Не** закрыты **F03/F04**, GitHub settings, deploy, реклама и GROW-пилоты.

## Свидетельства и ограничения

- Green CI ≠ deploy. PASS только на exact SHA.
- Код release-upgrade contract задаёт target `0090_ad_placement_lifecycle`; фактический результат upgrade следует проверять по evidence нужного SHA. Исторические проверки `0087`/`0089` не подтверждают новый target.
- На момент исторической сверки GitHub: public. Ruleset `Protect main (OPS-09)` по указанию владельца приведён к обычному виду: `required_status_checks` (CI result) + `deletion` + `non_fast_forward`, обязательное approving-review снято. Дальнейшие GitHub settings — только по поручению владельца.
- Статусы задач берутся из `planning/tasks.json`; `done` ≠ production enablement.

## Приоритетные остатки

**Operational gates:** F03, F04, OPS live/github_settings. **Product:** GROW пилоты, ads UX-24–26. Перед следующим DDL — disposable generate rehearsal. Дальше — законченные пользовательские циклы и эксплуатационная приёмка, не micro-honesty PR.

## Версии и инфраструктура

Node `26.11.1`, pnpm `12.4.2`; Docker `node:26-alpine`. PostgreSQL 18. См. [OPERATIONS.md](OPERATIONS.md), [RELEASE-PLAN.md](RELEASE-PLAN.md).

## Как обновлять этот файл

После значимой интеграции: tip `main`, доказательства CI/acceptance, открытые gates. История в Git — не копировать каждый tip-honesty merge сюда.

**Источники:** [AGENT.md](AGENT.md), [PROBLEMS.md](PROBLEMS.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md), `planning/tasks.json`, [AGENTS.md](../AGENTS.md).
