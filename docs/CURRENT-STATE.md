# Проверенный срез проекта

**Дата:** 1 ноября 2026. **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **Каноническая ветка:** `main`. **Tip (последний коммит):** `13eac8832c5e3364bd98b9dabcd207424ff45960` (`fix(web): type unfollow confirmAction mock for CI`). **Версия приложения:** `1.2.0-beta.3` (не поднималась этой волной).

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

На tip закрыты кодовые разрывы аудита (см. [PROBLEMS.md](PROBLEMS.md)): F01/F02/F05/F06/F08/F09/F10(усиление)/UI01/INT13(idempotency)/ARC14(authoring) + связанные FLOW/UX/OPS/GROW-01 и **UX-19** (gallery lightbox), **UX-20** (version help), **UX-22** (publication readiness). TypeScript-блокеры интеграции на `main` сняты. **Не** закрыты **F03/F04** (operational gates) и human/deploy gates beta-кандидата.

**Последняя локальная волна на tip:** free-beta UX honesty — unfollow через `confirmAction`, раздельные empty vs filtered состояния (profile history, reports), guest sign-in return paths; поверх UX-06, guest discussion draft + UNAUTHORIZED sign-in CTA, GROW-01 window helpers, UX surface tests, observability evidence hardening, GROW-08 server-pack spec draft. **Verified CI green on this tip:** https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41341277014

## Свидетельства и ограничения

| Область         | Что установлено                                                                                                                                                                                                                                                                                                                                                                                   | Что из этого не следует                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Исходники       | DOC + P1/P2 в `main`; tip `13eac883…`                                                                                                                                                                                                                                                                                                                                                             | Tip ≠ production                            |
| CI              | **Verified green на tip `13eac883…`:** [CI 41341277014](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41341277014) — lint/unit, DB, image build, production browser smoke. Более ранние прогоны на других SHA — только по exact SHA в Actions (промежуточный tip после merge: TS failures [41285198461](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41285198461)).  | PASS только на exact SHA; green CI ≠ deploy |
| Upgrade/restore | Retained artifacts базы: PASS disposable                                                                                                                                                                                                                                                                                                                                                          | Не production backup practice               |
| GitHub          | Public; main protection на проверке базы отсутствовала                                                                                                                                                                                                                                                                                                                                            | Не менять settings без поручения            |
| Tracker         | 64 done / 19 open (OPS external/github_settings, GROW pilots, ads UX-24–26)                                                                                                                                                                                                                                                                                                                       | `done` ≠ production enablement              |
| Архитектура     | `pnpm analyze:architecture` PASS (на tip-волне)                                                                                                                                                                                                                                                                                                                                                   | Не заменяет unit/database/full_acceptance   |

## Приоритетные остатки

**Operational gates:** F03 (alert routing), F04 (backup/recovery contract), OPS live/github_settings. **Product:** GROW пилоты, ads **UX-24–26**. Перед следующим DDL — disposable generate rehearsal. После нужных human gates — `pnpm beta:fetch` / `pnpm beta:candidate` на **exact tip SHA** (см. [PROBLEMS.md](PROBLEMS.md)).

## Версии и инфраструктура

Node `26.10.0`, pnpm `12.4.2`; Docker `node:26-alpine`. PostgreSQL 18. См. [OPERATIONS.md](OPERATIONS.md), [RELEASE-PLAN.md](RELEASE-PLAN.md).

## Как обновлять этот файл

После значимой интеграции: tip `main`, доказательства CI/acceptance, открытые gates. История в Git.

**Источники:** [AGENT.md](AGENT.md), [PROBLEMS.md](PROBLEMS.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md), `planning/tasks.json`, [AGENTS.md](../AGENTS.md).
