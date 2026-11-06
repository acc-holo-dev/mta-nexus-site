# Проверенный срез проекта

**Статус:** living · факт tip, не changelog.  
**Дата среза:** 6 ноября 2026 (Europe/Moscow). **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **Ветка:** `main`. **Версия приложения:** `1.2.0-beta.3`.

Стиль документации: [DOCS-STYLE.md](DOCS-STYLE.md). Рабочий вход агента: [AGENT.md](AGENT.md).

## Tip и CI (факт)

| Поле | Значение |
| ---- | -------- |
| Tip `origin/main` (на дату среза) | `3acacfdb` |
| Последний зафиксированный verified-green tip | `6cefa74e` — session-binding / recovery wave; [CI 41977081393](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/41977081393) SUCCESS |
| Правило | PASS только на exact SHA. Зелёный CI ≠ production deploy. Не объявлять tip verified-green без SUCCESS на текущем SHA. |

История промежуточных tip/PR — в Git, не в этом файле.

## Оценка стадии

**Кандидат открытой бесплатной beta** с незакрытой продуктовой и эксплуатационной приёмкой. Оценка по коду и проверкам на зафиксированном tip SHA — **не** утверждение о production readiness.

На tip закрыты кодовые разрывы аудита (см. [PROBLEMS.md](PROBLEMS.md)): F01/F02/F05/F06/F08/F09/F10 (усиление), UI01, INT13, ARC14, а также принятые FLOW/UX/OPS/GROW-01 и UX-19/20/22. **Не** закрыты без live evidence / допуска: **F03**, **F04**, GitHub settings, production deploy, реклама (UX-24–26), GROW-пилоты.

## Что уже на tip (кратко)

- Open free beta copy на публичных/legal/support/commerce поверхностях; платные механики отключены.
- Honesty/a11y: ErrorState/confirmAction, loading/empty/error shells, filter focus-visible.
- Auth: полный chrome на `/auth`; logout → `/auth/login`.
- Guest return: безопасный `next=` / return path после входа (FLOW-01 линия).
- Schema tip (SQL в repo): **`0089_resource_qa`** (также `0088_follow_mute_and_notify_comments`); миграции forward-only.
- HTTP → service для составных write; object-mute → `followWorkspaceService` / id prefix `omi`.

Подробности продукта и границ — [PRODUCT.md](PRODUCT.md), карта — [PROJECT-MAP.md](PROJECT-MAP.md).

## Открытые gates и приоритет

| Тип | Остаток |
| --- | ------- |
| Operational | **F03** alert routing, **F04** backup/recovery — нужны drills на целевой среде + evidence (#191 schemas). OPS-09/11 `github_settings` — только по допуску. |
| Product deferred | GROW-02…09, ads UX-24–26 — без активации. |
| Перед DDL | Disposable generate rehearsal (OPS-06). |
| После human gates | `pnpm beta:fetch` / `pnpm beta:candidate` на exact tip SHA. |

Tracker: **64** `done` / **19** `not_started` (`python3 planning/tools/list_open_tasks.py`). Статус только в `planning/tasks.json` — см. [TRACKER.md](../planning/TRACKER.md).

## Старт для следующего агента

1. `git checkout main && git pull --ff-only` → чистый status; зафиксировать exact SHA tip; сначала CI для этого SHA.
2. Читать [AGENT.md](AGENT.md), этот файл, [PROBLEMS.md](PROBLEMS.md), `planning/tasks.json`. Markdown backlog — только `python planning/tools/render_backlog.py`.
3. Defaults владельца A/B — [DECISIONS.md](DECISIONS.md). Ads/commerce/GROW пилоты не активированы.
4. Не гонять `pnpm db:generate` на живой БД. Scratch (`scripts/_agent_*`, `.dsh-ops/`) не коммитить.
5. Push / GitHub settings / production deploy / платежи — только по прямому указанию владельца.
6. Не закрывать F03/F04, settings, deploy, рекламу и GROW без допуска и свидетельств с целевой среды.

## Свидетельства и ограничения

- CI на tip не означает production readiness.
- Disposable upgrade/restore artifacts = локальный PASS, не production backup practice.
- Локальные validators F03/F04 подготовлены; live gates открыты.
- `pnpm analyze:architecture` PASS на baseline-волне не заменяет unit/database/full_acceptance.

## Версии и инфраструктура

Node `26.10.0`, pnpm `12.4.2`, Docker `node:26-alpine`, PostgreSQL 18. Команды — [OPERATIONS.md](OPERATIONS.md) ([ops/](ops/README.md)); доставка — [RELEASE-PLAN.md](RELEASE-PLAN.md).

## Как обновлять этот файл

После значимой интеграции на `main`: обновить tip SHA, стадию, открытые gates и краткий факт «что изменилось для пользователя/оператора». Не добавлять построчный журнал PR. История — в Git.

**Источники:** [AGENT.md](AGENT.md), [DOCS-STYLE.md](DOCS-STYLE.md), [PROBLEMS.md](PROBLEMS.md), [DECISIONS.md](DECISIONS.md), [ROADMAP.md](ROADMAP.md), `planning/tasks.json`, [AGENTS.md](../AGENTS.md).
