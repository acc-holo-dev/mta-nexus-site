# MTA NEXUS

Платформа сообщества Multi Theft Auto: каталог серверов, публикации, профили и безопасное распространение ресурсов. Текущая версия: `1.2.0-beta.3`, закрытая бета. Платежи и выплаты не включены; коммерческий marketplace и DRM — утверждённая цель, а не действующая функция.

**Active development branch:** `main` only. Production-развёртывание требует отдельного решения.

## Запуск

Установите Docker и Docker Compose. Рекомендуемый full Docker development stack:

```sh
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
```

При установленных Node.js 26.10.0 и pnpm 12.4.2: `pnpm dev` запускает тот же полный стек. `pnpm dev:host` запускает только Next.js и требует настроенные PostgreSQL, хранилище и другие зависимости. Дополнительный захват писем: `pnpm dev:mail`. Команды миграции и демонстрационных данных: `pnpm db:migrate`, `pnpm db:seed`.

## Проверки

- `pnpm check:code` — lint, типы, анализ, unit и tooling-тесты.
- `pnpm test:unit` — unit-тесты. `pnpm test:database` — последовательные тесты с отдельной тестовой БД.
- `pnpm test:focus tests/example.test.ts` — только перечисленные файлы. Для тестов БД задайте `DATABASE_URL` отдельной одноразовой базы и `NEXUS_DISPOSABLE_DATABASE=1`; сначала примените к ней миграции.
- `pnpm docs:check` — проверка локальных Markdown-ссылок и разделов.
- `pnpm build` — production-сборка; параметры окружения для неё указаны в Dockerfile.
- `pnpm test:isolated` — полный Vitest-набор в одноразовой БД внутри работающего Docker-стека. Команда пересоздаёт тестовую базу: не направляйте её на пользовательские данные.
- `pnpm release:verify` — выполнение релизных проверок и запись свидетельств; команда не развёртывает проект.

Для изменения конкретного модуля сначала запускайте связанные тесты, затем проверки, соответствующие риску. Подробнее: [эксплуатация](docs/OPERATIONS.md).

## Структура

- `apps/web` — страницы, интерфейс, HTTP API и сервисы.
- `packages/db` — схема PostgreSQL, миграции, репозитории и работники.
- `packages/domain`, `validation`, `security`, `storage`, `config`, `ui` — общие правила и компоненты.
- `tests`, `scripts` — поведенческие проверки и инструменты эксплуатации.

## Документация

[Правила для разработчика](AGENTS.md) · [Архитектура](docs/ARCHITECTURE.md) · [Эксплуатация](docs/OPERATIONS.md) · [Открытые проблемы](docs/PROBLEMS.md) · [Продуктовые решения](docs/handbook/13-DECISION-REGISTER.md) · [Карта предметных областей](docs/handbook/00-README.md).

Фактическое поведение определяется кодом и миграциями. Утверждённые цели и текущая реализация могут отличаться. Старые сведения доступны в истории Git.
