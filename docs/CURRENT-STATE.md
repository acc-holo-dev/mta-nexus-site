# Проверенный срез проекта

**Дата сверки:** 16 ноября 2026. **Репозиторий:** [acc-holo-dev/mta-nexus-site](https://github.com/acc-holo-dev/mta-nexus-site). **Постоянные ветки:** `dev` → `main`. **Версия:** `1.2.0-beta.3`.

На дату сверки tip `main` — `bb0301dd78af158de594d056aa1acd9708dd08e9` (merge [PR #1179](https://github.com/acc-holo-dev/mta-nexus-site/pull/1179)); ветка `dev` вводится как единственная интеграционная линия перед `main`. Архитектурный перенос объединён: приложение и пакеты находятся в `site/`, инфраструктура — в `docker/` и `config/`, функциональный код сгруппирован в `site/src/features/`. Пути и границы — в [карте проекта](PROJECT-MAP.md) и [архитектуре](ARCHITECTURE.md). Проект переноса документации: [future/documentation-system.md](future/documentation-system.md).

## Проверки

Полный [CI #43778446076](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43778446076) прошёл на merge SHA: 8373 unit-теста, 1155 тестов БД, production image, Docker, браузерные сценарии и disposable backup/restore. Release-upgrade rehearsal прошёл до миграции `0090_ad_placement_lifecycle`. Отдельный [Discussion recovery CI #43778446088](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/43778446088) также прошёл. Результаты относятся только к указанному SHA; новый commit требует собственной проверки.

## Граница продукта и выпуска

Бесплатная beta — ближайшая линия выпуска; успешный CI не означает, что открытая beta запущена или production deploy разрешён. Реальные платежи, выплаты и production DRM не включены. Рекламные механизмы за выключенными по умолчанию флагами не означают запущенную рекламную систему. Цели и действующее поведение различаются в [продуктовом контракте](PRODUCT.md) и [COMMERCIAL-FUTURE](COMMERCIAL-FUTURE.md).

Оставшиеся условия приёмки и внешние свидетельства — в [RELEASE-READINESS](RELEASE-READINESS.md) и [PROBLEMS](PROBLEMS.md). Доступность production, доставка оповещений и реальное восстановление на целевой инфраструктуре не подтверждаются локальным или hosted CI.

## Где искать следующее действие

- Единственный tracker — [`planning/tasks.json`](../planning/tasks.json); [ROADMAP](ROADMAP.md), [TASKS](TASKS.md) и [TRACEABILITY](TRACEABILITY.md) генерируются из него. На дату сверки: 65 `done`, 18 `not_started`; статус не означает production enablement.
- Рабочие правила и разрешения — [AGENT](AGENT.md) и [AGENTS](../AGENTS.md); операторские команды — [OPERATIONS](OPERATIONS.md).
- Миграции forward-only; `pnpm db:generate` не применяют к живой БД. Q&A demo fixtures относятся к `db:seed:historical`, не к базовому seed.
- Существующие решения и их ID сохраняются в [DECISIONS](DECISIONS.md) и [реестре](handbook/13-DECISION-REGISTER.md). История старых снимков доступна в Git.

Обновляйте этот срез после значимой интеграции: указывайте проверенный SHA и доказательства, не копируя сюда историю каждого изменения.
