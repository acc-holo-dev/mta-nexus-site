# MTA NEXUS

Платформа сообщества Multi Theft Auto: каталог серверов, публикации, профили и безопасное распространение ресурсов. Текущая версия: `1.2.0-beta.3`, закрытая бета. Платежи и выплаты не включены; коммерческий marketplace и DRM — утверждённая цель, а не действующая функция.

**Active development branch:** `main` only. Production-развёртывание требует отдельного решения.

Быстрая ориентация по репозиторию: [карта проекта](docs/PROJECT-MAP.md).

## Запуск

Установите Docker и Docker Compose. Рекомендуемый full Docker development stack:

```sh
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
```

При установленных Node.js 26.10.0 и pnpm 12.4.2:

| Команда                            | Назначение                                            |
| ---------------------------------- | ----------------------------------------------------- |
| `pnpm nexus:doctor`                | Preflight: Node/pnpm/Docker/порт/`compose.yaml`       |
| `pnpm dev`                         | Полный Compose-стек (тот же, что выше)                |
| `pnpm dev:docker:check`            | Readiness app + push-worker                           |
| `pnpm dev:host`                    | Только Next.js (Postgres/storage/scanner уже снаружи) |
| `pnpm dev:mail`                    | Стек + Mailpit для локального захвата писем           |
| `pnpm db:migrate` / `pnpm db:seed` | Миграции и демо-данные                                |

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

- `apps/web` — страницы, интерфейс, HTTP API и сервисы.
- `packages/db` — схема PostgreSQL, миграции, репозитории и работники.
- `packages/domain`, `validation`, `security`, `storage`, `config`, `ui` — общие правила и компоненты.
- `tests`, `scripts` — поведенческие проверки и инструменты эксплуатации.

Слои и границы пакетов: [архитектура](docs/ARCHITECTURE.md). Таблица путей и CI: [карта проекта](docs/PROJECT-MAP.md).

## Документация

[Правила для разработчика](AGENTS.md) · [Карта проекта](docs/PROJECT-MAP.md) · [Архитектура](docs/ARCHITECTURE.md) · [Эксплуатация](docs/OPERATIONS.md) · [Открытые проблемы](docs/PROBLEMS.md) · [Продуктовые решения](docs/handbook/13-DECISION-REGISTER.md) · [Карта предметных областей](docs/handbook/00-README.md).

Фактическое поведение определяется кодом, миграциями и выполненными проверками. Утверждённые цели и текущая реализация могут отличаться. Старые сведения доступны в истории Git.
