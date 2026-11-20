# MTA NEXUS

Платформа сообщества Multi Theft Auto: каталог серверов, публикации, профили и безопасное распространение ресурсов. Текущая версия: `1.2.0-beta.3`; ближайшая линия выпуска — бесплатная бета. Платежи и выплаты не включены; коммерческий marketplace и DRM — утверждённая цель, а не действующая функция.

**Permanent branches:** `dev` (integration) → `main` (release line). Других долгоживущих веток нет. Production-развёртывание требует отдельного решения.

## Состояние в 30 секунд

- **Для кого и что подтверждено:** [docs/current/system.md](docs/current/system.md). Что ещё открыто: [docs/issues/constraints.md](docs/issues/constraints.md).
- **Что реально запускается локально:** `pnpm dev` → приложение http://127.0.0.1:3000 (шаг за шагом — [docs/current/development.md](docs/current/development.md)).
- **Где спросить/куда двигаться:** [карта проекта](docs/PROJECT-MAP.md); правила исполнителя — [AGENTS.md](AGENTS.md) и [контракт агента](docs/AGENT.md).

> **Языки:** контракты и большинство `docs/` — русский; `OPERATIONS.md` — English-first и authoritative для команд; код, коммиты и CI — английский; интерфейс — RU/EN. Из языка файла не выводите его важность.

## Запуск

Установите Docker и Docker Compose. Рекомендуемый full Docker development stack:

```sh
docker compose -p nexus-local -f docker/compose.yaml up --build --detach --wait --wait-timeout 600
docker compose -p nexus-local -f docker/compose.yaml exec app node scripts/check-local-readiness.mjs
```

При необходимости создайте `docker/.env` из `config/env/.env.example`, не перезаписывая существующий файл. Compose читает `docker/.env` как project directory; без него стек работает на dev-дефолтах из `docker/compose.yaml`. Для host-only Next (`pnpm dev:host`) переменные задаются в корневом `.env`.

При установленных Node.js 26.11.1 и pnpm 12.4.2:

| Команда                            | Назначение                                             |
| ---------------------------------- | ------------------------------------------------------ |
| `pnpm nexus:doctor`                | Preflight: Node/pnpm/Docker/порт/`docker/compose.yaml` |
| `pnpm dev`                         | Полный Compose-стек (тот же, что выше)                 |
| `pnpm dev:docker:check`            | Readiness app + push / license / resource-release      |
| `pnpm dev:host`                    | Только Next.js (Postgres/storage/scanner уже снаружи)  |
| `pnpm dev:mail`                    | Стек + Mailpit для локального захвата писем            |
| `pnpm db:migrate` / `pnpm db:seed` | Миграции и демо-данные                                 |

При обновлении со старым `deploy/.env` сохраните его значения; порядок перехода — в [OPERATIONS](docs/OPERATIONS.md#infrastructure-directory-migration).

## Проверки

| Команда                                | Когда                                                               |
| -------------------------------------- | ------------------------------------------------------------------- |
| `pnpm check:code`                      | Формат, lint, типы, boundaries, unused, unit + tooling (без Docker) |
| `pnpm test:unit`                       | Изолированные unit/mock                                             |
| `pnpm test:database`                   | Последовательные DB-тесты на **отдельной** disposable БД            |
| `pnpm test:focus path/to/file.test.ts` | Узкий Vitest / `.node-test.mjs` прогон                              |
| `pnpm docs:check`                      | Локальные Markdown-ссылки и якоря                                   |
| `pnpm build`                           | Production-сборка (env — Dockerfile)                                |
| `pnpm test:isolated`                   | Полный Vitest в одноразовой БД внутри Docker-стека                  |
| `pnpm release:verify`                  | Релизные свидетельства; **не** deploy                               |

Для тестов БД через `test:focus`: `DATABASE_URL` на одноразовую базу, миграции, `NEXUS_DISPOSABLE_DATABASE=1`. Unit и database запускаются отдельно с окружением соответствующего CI-проекта. Для Compose доступен `test:focus:compose`, в том числе с тестами рядом с feature-кодом. Подробнее: [эксплуатация](docs/OPERATIONS.md).

## Структура

- `site` — страницы, интерфейс, HTTP API и сервисы.
- `site/packages/db` — схема PostgreSQL, миграции, репозитории и работники.
- `site/packages/domain`, `validation`, `security`, `storage`, `config`, `ui` — общие правила и компоненты.
- `site/tests`, `scripts` — поведенческие проверки и инструменты эксплуатации.

Слои и границы пакетов: [архитектура](docs/ARCHITECTURE.md). Таблица путей и CI: [карта проекта](docs/PROJECT-MAP.md).

## Документация

**Начать здесь:** [Система](docs/current/system.md) · [Разработка](docs/current/development.md) · [CI / качество](docs/current/quality.md) · [Карта проекта](docs/PROJECT-MAP.md) · [Ограничения](docs/issues/constraints.md).

**Контракты и правила (исполнители):** [Правила](AGENTS.md) · [Агент](docs/AGENT.md) · [Механика вклада](CONTRIBUTING.md) · [Решения](docs/DECISIONS.md) · [Реестр ID](docs/handbook/13-DECISION-REGISTER.md) · [Roadmap](docs/ROADMAP.md) · [Инициативы](docs/future/initiatives.md).

**Предметные контракты:** [Ресурсы](docs/current/domains/RESOURCES.md) · [Сообщество](docs/current/domains/COMMUNITY.md) · [Серверы/org](docs/current/domains/SERVERS-ORGS.md) · [Trust/staff](docs/current/domains/TRUST-STAFF.md) · [Коммерция](docs/future/commerce.md).

**Справочник и эксплуатация:** [Архитектура](docs/ARCHITECTURE.md) · [Эксплуатация](docs/OPERATIONS.md) — authoritative runbook · [Handbook](docs/handbook/00-README.md) — вступление и реестры.

Единственный рабочий tracker: [`planning/tasks.json`](planning/tasks.json) ([контракт](planning/TRACKER.md); Markdown — ROADMAP/TASKS/TRACEABILITY). Замороженный import baseline для будущего Issues: `planning/import-baseline/`. Система документации: [documentation-system](docs/future/documentation-system.md). Фактическое поведение определяется кодом, миграциями и выполненными проверками. Утверждённые цели и текущая реализация могут отличаться. Старые сведения доступны в истории Git.
