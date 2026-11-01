# Проверенный срез проекта

**Дата:** 1 ноября 2026. **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **База пакета:** `385e577e7443cf7d7b817419ce5c3b8afe87b690`. **Рабочая ветка handoff:** `docs/doc-01-02-core-integration` @ `ce6cf8eab394689b8eac9d14f2ec6203a4b65fd2`. **Версия приложения:** `1.2.0-beta.3` (не поднималась этой волной).

## Оценка стадии

Рабочая формулировка: **кандидат бесплатной beta с незакрытой продуктовой и эксплуатационной приёмкой**. В репозитории есть существенная работающая основа и обновлённые контракты DOC/FLOWS/UX/OPS. Это оценка по коду и локальным проверкам ветки, не утверждение о production и не процент готовности бизнеса.

## Handoff для следующего агента (2026-11-01)

1. Читайте [AGENT.md](AGENT.md), этот файл, [PROBLEMS.md](PROBLEMS.md), открытые карточки в `planning/tasks.json` (61 `done` / 22 `not_started`). `docs/TASKS.md` и ROADMAP — только через `python planning/tools/render_backlog.py`.
2. Сохраните незакоммиченное только если оно появится после tip ветки; `_agent_*` и `.dsh-ops/` в `.gitignore` — не коммитить.
3. Владелец принял рабочие defaults A/B в [DECISIONS.md](DECISIONS.md) (FLOW-05/06/12, UX-06/14/17/23, OPS-19, GROW-01). Ads/commerce/GROW пилоты **не** активированы.
4. Schema tip journal: `0089_resource_qa` (после `0088_follow_mute_and_notify_comments`). Миграции forward-only; `pnpm db:generate` на живой БД не гонять (OPS-06).
5. Архитектура: HTTP→service для новых write/составных путей. `object-mute` идёт через `followWorkspaceService` (не расширять `.dependency-cruiser.exceptions.cjs` ради mute).
6. Push / GitHub settings / production deploy / платежи — только по прямому указанию владельца (AGENTS + AI-007).
7. Следующая очередь по зависимостям: operational gates **OPS-09…20** (среда), UX-19/20/22/24–26, GROW-02…09 (пилоты после словаря GROW-01). Не открывать ads/commerce без нового поручения.

Локально закрыты кодовые разрывы аудита (см. PROBLEMS): F01/F02/F05/F06/F08/F09/F10(усиление)/UI01/INT13/ARC14(authoring path) + волны FLOW/UX/OPS/GROW-01. **Не** закрыты live gates F03/F04 и полный `full_acceptance` на новом tip SHA.

## Свидетельства и ограничения

| Область | Что установлено | Что из этого не следует |
|---|---|---|
| Исходники | База `385e577e…` = remote main на старте пакета; интеграция DOC + P1/P2 живёт на ветке handoff | Tip ветки ≠ production; CI на новом SHA ещё не доказан этим срезом |
| CI | Ранее: [full acceptance 41247970713](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41247970713) для базы `385e577e…`, 15 jobs | Новый tip требует своих доказательств; не переносить PASS |
| Upgrade/restore | Retained artifacts базы: PASS на disposable | Не production backup schedule / off-host copy |
| GitHub | Main на проверке базы не защищён; public; rulesets/releases пусты | Не менять visibility/protection без `github_settings` |
| Документация | DOC-01…05: AGENT/CURRENT-STATE/DECISIONS/PRODUCT/FLOWS/UX/предметные контракты; DOC-04 удалил 49 handbook-глав (история в Git); 00/13/15 сохранены | Число документов ≠ качество |
| Tracker | `planning/tasks.json`: 61 done / 22 open | `done` ≠ production enablement |
| Архитектура | `pnpm analyze:architecture` PASS на handoff tip перед публикацией коммитов | Не заменяет unit/database/full_acceptance |
| Контракт изменений | Push только по прямому указанию владельца | Не разрешает deploy / destructive / платежи |

## Приоритетные остатки

Operational: F03 observability routing, F04 real backup practice, OPS live GHCR/deploy/settings карточки. Product proposals: GROW пилоты, UX polish 19/20/22/24–26. Перед следующим DDL — disposable generate rehearsal (ARC14). Full acceptance + `pnpm beta:candidate` только на exact tip SHA после push/CI.

## Версии и инфраструктура

Repo pins: Node `26.10.0`, pnpm `12.4.2`; Docker `node:26-alpine` (floating patch). PostgreSQL 18. Workflow GHCR→production ещё проект доставки, не готовая цепочка. См. [OPERATIONS.md](OPERATIONS.md), [RELEASE-PLAN.md](RELEASE-PLAN.md).

## Как обновлять этот файл

После значимой интеграции или выпуска: SHA tip, среда, ссылки на доказательства, открытые gates. История — в Git. Не дублировать backlog и не вести ежедневный журнал.

**Источники:** [AGENT.md](AGENT.md), [PROBLEMS.md](PROBLEMS.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md), `planning/tasks.json`, [AGENTS.md](../AGENTS.md).
