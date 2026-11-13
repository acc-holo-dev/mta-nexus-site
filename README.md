# MTA NEXUS

Платформа сообщества Multi Theft Auto: каталог серверов, публикации, профили и безопасное распространение ресурсов. Текущая версия: `1.2.0-beta.3`, открытая бесплатная бета. Платежи и выплаты не включены; коммерческий marketplace и DRM — утверждённая цель, а не действующая функция.

**Active development branch:** `main` only. Production-развёртывание требует отдельного решения.

## Состояние в 30 секунд

- **Для кого:** игроки, владельцы серверов, авторы ресурсов, команды-организации, покупатели/продавцы и staff. Кому и какую задачу решаем — [PRODUCT.md](docs/PRODUCT.md).
- **Что уже подтверждено сейчас:** [CURRENT-STATE.md](docs/CURRENT-STATE.md). Что ещё открыто: [PROBLEMS.md](docs/PROBLEMS.md).
- **Что реально запускается локально:** `pnpm dev` → приложение http://127.0.0.1:3000 (шаг за шагом — [GETTING-STARTED.md](docs/GETTING-STARTED.md)).
- **Где спросить/куда двигаться:** [карта проекта](docs/PROJECT-MAP.md); правила исполнителя — [AGENTS.md](AGENTS.md) и [контракт агента](docs/AGENT.md).

> **Языки:** контракты и большинство `docs/` — русский; `OPERATIONS.md` — English-first и authoritative для команд; код, коммиты и CI — английский; интерфейс — RU/EN. Из языка файла не выводите его важность.

## Запуск

Установите Docker и Docker Compose. Рекомендуемый full Docker development stack:

```sh
docker compose -p nexus-local -f docker/compose.yaml up --build --detach --wait --wait-timeout 600
docker compose -p nexus-local -f docker/compose.yaml exec app node scripts/check-local-readiness.mjs
```

Копия заготовки переменных окружения для локального Compose-стека: `cp config/env/.env.example docker/.env` — Compose читает `docker/.env` как project directory; без копии стек работает на безопасных dev-дефолтах из `docker/compose.yaml`. Для host-only Next (`pnpm dev:host`) переменные задаются в корневом `.env`.

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

Для тестов БД через `test:focus`: `DATABASE_URL` на одноразовую базу, миграции, `NEXUS_DISPOSABLE_DATABASE=1`. Сначала связанные тесты модуля, затем проверки по риску. Подробнее: [эксплуатация](docs/OPERATIONS.md).

## Структура

- `site` — страницы, интерфейс, HTTP API и сервисы.
- `site/packages/db` — схема PostgreSQL, миграции, репозитории и работники.
- `site/packages/domain`, `validation`, `security`, `storage`, `config`, `ui` — общие правила и компоненты.
- `tests`, `scripts` — поведенческие проверки и инструменты эксплуатации.

Слои и границы пакетов: [архитектура](docs/ARCHITECTURE.md). Таблица путей и CI: [карта проекта](docs/PROJECT-MAP.md).

## Документация

**Начать здесь:** [Быстрый старт](docs/GETTING-STARTED.md) · [Карта проекта](docs/PROJECT-MAP.md) · [Состояние](docs/CURRENT-STATE.md) · [Продукт](docs/PRODUCT.md).

**Контракты и правила (исполнители):** [Правила](AGENTS.md) · [Агент](docs/AGENT.md) · [Механика вклада](CONTRIBUTING.md) · [Решения](docs/DECISIONS.md) · [Реестр ID](docs/handbook/13-DECISION-REGISTER.md) · [Roadmap](docs/ROADMAP.md) · [Проблемы](docs/PROBLEMS.md).

**Предметные контракты:** [Ресурсы](docs/RESOURCES.md) · [Сообщество](docs/COMMUNITY.md) · [Серверы/org](docs/SERVERS-ORGS.md) · [Trust/staff](docs/TRUST-STAFF.md) · [Коммерция](docs/COMMERCIAL-FUTURE.md).

**Справочник и эксплуатация:** [Архитектура](docs/ARCHITECTURE.md) · [Эксплуатация](docs/OPERATIONS.md) — authoritative runbook · [Handbook](docs/handbook/00-README.md) — вступление и реестры.

Единственный рабочий tracker: [`planning/tasks.json`](planning/tasks.json) ([контракт](planning/TRACKER.md); Markdown — ROADMAP/TASKS/TRACEABILITY). Замороженный import baseline для будущего Issues: `planning/import-baseline/`. Миграция handbook: [DOCS-MIGRATION](docs/DOCS-MIGRATION.md). Фактическое поведение определяется кодом, миграциями и выполненными проверками. Утверждённые цели и текущая реализация могут отличаться. Старые сведения доступны в истории Git.
