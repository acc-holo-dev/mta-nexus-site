# Проверенный срез проекта

**Дата:** 1 ноября 2026. **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **Каноническая ветка:** `main`. **База пакета (до интеграции):** `385e577e7443cf7d7b817419ce5c3b8afe87b690`. **Интеграционный feat-коммит:** `ce6cf8eab394689b8eac9d14f2ec6203a4b65fd2`. Актуальный tip — `git rev-parse origin/main` после `git pull`. **Версия приложения:** `1.2.0-beta.3` (не поднималась этой волной).

## Оценка стадии

Рабочая формулировка: **кандидат бесплатной beta с незакрытой продуктовой и эксплуатационной приёмкой**. Оценка по коду и локальным проверкам на `main`, не утверждение о production.

## Старт для следующего агента

1. Только **`main`**: `git checkout main && git pull` → чистый `git status`. Читайте [AGENT.md](AGENT.md), этот файл, [PROBLEMS.md](PROBLEMS.md), `planning/tasks.json` (61 `done` / 22 `not_started`). Markdown backlog — только через `python planning/tools/render_backlog.py`.
2. Локальный scratch (`scripts/_agent_*`, `.dsh-ops/`) в `.gitignore` и не должен появляться в коммитах. Не ведите параллельные handoff-журналы.
3. Defaults владельца A/B — [DECISIONS.md](DECISIONS.md) (FLOW-05/06/12, UX-06/14/17/23, OPS-19, GROW-01). Ads/commerce/GROW пилоты не активированы.
4. Schema tip: `0089_resource_qa`. Миграции forward-only; не гонять `pnpm db:generate` на живой БД (OPS-06).
5. HTTP→service для новых write/составных путей; object-mute → `followWorkspaceService` / id prefix `omi`.
6. Push / GitHub settings / production deploy / платежи — только по прямому указанию владельца.
7. Очередь: OPS-09…20 (live), UX-19/20/22/24–26, GROW-02…09. Не открывать ads/commerce без нового поручения.

Локально закрыты кодовые разрывы аудита (PROBLEMS): F01/F02/F05/F06/F08/F09/F10(усиление)/UI01/INT13/ARC14(authoring) + FLOW/UX/OPS/GROW-01. TypeScript-блокеры tip `main` после интеграции исправлены отдельным коммитом (library-collections narrowing, mute prefix, privateApiRequest json, support category, SemVer compare). **Не** закрыты F03/F04 и полный `full_acceptance` до зелёного CI на новом tip.

## Свидетельства и ограничения

| Область | Что установлено | Что из этого не следует |
|---|---|---|
| Исходники | DOC + P1/P2 в `main`; рабочая ветка интеграции удалена | Tip ≠ production |
| CI | База `385e577e…`: [full acceptance 41247970713](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41247970713). Tip после merge имел TS failures в [41285198461](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41285198461); фикс уходит новым tip | PASS только на exact SHA |
| Upgrade/restore | Retained artifacts базы: PASS disposable | Не production backup practice |
| GitHub | Public; main protection на проверке базы отсутствовала | Не менять settings без поручения |
| Tracker | 61 done / 22 open | `done` ≠ production enablement |
| Архитектура | `pnpm analyze:architecture` PASS | Не заменяет unit/database/full_acceptance |

## Приоритетные остатки

Operational: F03/F04, OPS live. Product: GROW пилоты, UX 19/20/22/24–26. Перед DDL — disposable generate rehearsal. После зелёного CI — `full_acceptance` / `pnpm beta:candidate` на exact tip.

## Версии и инфраструктура

Node `26.10.0`, pnpm `12.4.2`; Docker `node:26-alpine`. PostgreSQL 18. См. [OPERATIONS.md](OPERATIONS.md), [RELEASE-PLAN.md](RELEASE-PLAN.md).

## Как обновлять этот файл

После значимой интеграции: tip `main`, доказательства, открытые gates. История в Git.

**Источники:** [AGENT.md](AGENT.md), [PROBLEMS.md](PROBLEMS.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md), `planning/tasks.json`, [AGENTS.md](../AGENTS.md).
