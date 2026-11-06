# Проверенный срез проекта

**Дата:** 6 ноября 2026. **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **Каноническая ветка:** `main`. **Версия приложения:** `1.2.0-beta.3`.

## Текущий tip

- **`origin/main` tip:** обновлять после merge текущего pack. Не объявлять verified-green без SUCCESS CI на exact SHA.
- **Последний verified-green tip:** `6cefa74e` / session-binding + order/storage/plan recovery — [CI 41977081393](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41977081393).
- Длинная серия tip-honesty / ErrorState residual PR после `6cefa74e` живёт в Git history; этот файл больше не дублирует каждый merge.

## Оценка стадии

Рабочая формулировка: **кандидат бесплатной beta с незакрытой продуктовой и эксплуатационной приёмкой**. Оценка по коду и проверкам на зафиксированном tip SHA; **не** production readiness.

## Продуктовые и инженерные факты на tip

- Core free-beta journeys (auth return, library acquire/download honesty, inbox filters, release watch, discussion intent, Home personal changes, resource Q&A) реализованы локально.
- Resource Q&A + platform abuse loop: member report UI на product/server/user; staff inbox deep link `reportId` + content moderationHref; reporter status notice → `/workspace/platform-reports`; discovery/follow mute hydration. Schema tip — `0089_resource_qa` (+ `0088`).
- Collection release-posture loop: inventory / collection releases / library updates project watch state + follow-latest/open; collection watches page has per-item toggle (membership still does not auto-enroll watches).
- Servers/orgs trust-staff: verification queue deep link `verificationId` + focused card; server claim/proof enrichment; ownership resolve notice → managed server; server report `moderationHref` → workspace claim status.
- Support staff notices deep-link to `/admin/support/:caseId` (queue list remains fallback for unsafe ids).
- Build-incident downloader notices open library versions/updates (not Security Center), with RU/EN localization via `data.kind = build_incident`.
- Publisher build honesty: review/quarantine/restore notices deep-link to `/workspace/resources/:productId/builds/:buildId` with RU/EN `build_lifecycle` copy (no malware invention).
- CI: main больше не отменяет in-flight full_acceptance; docs-only tip push не форсирует full scope.
- Open free beta copy на public/legal/support/commerce; paid surfaces остаются disabled.
- Auth chrome: full shell на `/auth`; logout → `/auth/login`.

## Старт для следующего агента

1. Только **`main`**: `git checkout main && git pull --ff-only` → чистый `git status`. Exact SHA → сначала GitHub CI для него. Читайте [AGENT.md](AGENT.md), этот файл, [PROBLEMS.md](PROBLEMS.md), `planning/tasks.json` (**64** `done` / **19** `not_started`). Markdown backlog — только через `python planning/tools/render_backlog.py`.
2. Scratch (`scripts/_agent_*`, `.dsh-ops/`) в `.gitignore`. Не вести параллельные handoff-журналы.
3. Defaults владельца — [DECISIONS.md](DECISIONS.md). Ads/commerce/GROW пилоты не активированы. **ErrorState residual / tip-honesty micro-PRs — не приоритет**, пока владелец не вернёт эту очередь.
4. Schema tip: **`0089_resource_qa`** (+ `0088_follow_mute_and_notify_comments`). Forward-only; не `pnpm db:generate` на живой БД. Q&A fixtures — `db:seed:historical`, не baseline seed.
5. HTTP→service для новых write/составных путей.
6. Push / GitHub settings / production deploy / платежи — только по прямому указанию владельца.
7. Live drills **F03/F04** и **OPS-09/11** — только с допуском и evidence целевой среды.

На tip закрыты кодовые разрывы аудита (см. [PROBLEMS.md](PROBLEMS.md)): F01/F02/F05/F06/F08/F09/F10(усиление)/UI01/INT13/ARC14 + FLOW/UX/OPS/GROW-01 и UX-19/20/22. **Не** закрыты **F03/F04**, GitHub settings, deploy, реклама и GROW-пилоты.

## Свидетельства и ограничения

- Green CI ≠ deploy. PASS только на exact SHA.
- Upgrade contract target = `0089_resource_qa`. Local disposable migrate-to-tip PASS на compose Postgres; retained hosted CI upgrade artifact may still cite `0087_server_reviews` until the next hosted PASS.
- GitHub: public; main protection на базе сверки отсутствовала. Settings не менять без поручения.
- Tracker: 64 done / 19 open. `done` ≠ production enablement.

## Приоритетные остатки

**Operational gates:** F03, F04, OPS live/github_settings. **Product:** GROW пилоты, ads UX-24–26. Перед следующим DDL — disposable generate rehearsal. Дальше — законченные пользовательские циклы и эксплуатационная приёмка, не micro-honesty PR.

## Версии и инфраструктура

Node `26.10.0`, pnpm `12.4.2`; Docker `node:26-alpine`. PostgreSQL 18. См. [OPERATIONS.md](OPERATIONS.md), [RELEASE-PLAN.md](RELEASE-PLAN.md).

## Как обновлять этот файл

После значимой интеграции: tip `main`, доказательства CI/acceptance, открытые gates. История в Git — не копировать каждый tip-honesty merge сюда.

**Источники:** [AGENT.md](AGENT.md), [PROBLEMS.md](PROBLEMS.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md), `planning/tasks.json`, [AGENTS.md](../AGENTS.md).
