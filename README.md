# MTA Nexus

MTA Nexus is a player-first discovery and resource platform for Multi Theft Auto: San Andreas.

The product answers one primary question: **what is happening in MTA right now?** Fresh server activity comes first, followed by community updates and a free resource library. Paid commerce remains disabled until a real payment provider and legal operating model are ready.

## Start here / С чего начать

[Карта бесплатной беты](docs/RELEASE-READINESS.md) описывает сценарии пользователей, доказательства, ограничения и ближайшую задачу. [Product Blueprint](docs/PRODUCT-BLUEPRINT.md) описывает более широкий продукт; галочка в roadmap не означает готовность релиза.

BETA-001 проверила PostgreSQL на новых именованных томах. BETA-002 добавила Docker-only запуск приложения, базы и ClamAV. Локальный запуск проверен в [CI №865](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35940008117/job/107445602459) на `bc048baaea71985e74d00faed4f66095dd518926`. Это не разрешение на публичный выпуск и не проверка всех пользовательских сценариев.

## Local development / Локальный запуск через Docker

Нужны доступ к репозиторию, Git и работающий Docker с Compose v2 в режиме Linux containers. Node, pnpm и PostgreSQL на компьютер устанавливать не нужно. Проверенное окружение — Linux x86_64 в CI; Docker Desktop на Windows/macOS отдельно не проверялся. Для загрузки образов, пакетов и обновлений ClamAV нужен доступ к сети.

ClamAV требует заметного объёма памяти: [официальная документация](https://docs.clamav.net/manual/Installing/Docker.html) рекомендует 4 GiB для него; приложению, базе и Docker также нужна память. Это не гарантия достаточности 4 GB для всей платформы и не рекомендация размера production-VDS.

Для новой локальной копии:

```bash
git clone --branch dev --single-branch https://github.com/acc-holo-dev/mta-nexus-site.git
cd mta-nexus-site
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

Откройте `http://localhost:3000`. Флаг `--wait` ожидает готовности сервисов; `600` — предел ожидания, а не обещание времени запуска. Создавать `.env` для стандартного локального запуска не требуется. В CI используется тот же `compose.yaml`, но отдельное имя проекта и пустой env-файл, чтобы не обращаться к чужим данным.

**Существующие данные:** используйте имя `nexus-local` только для своей локальной среды. Если проект с таким именем или его тома уже существуют, сначала выясните их назначение. Не подключайте production-тома. Изменение имени проекта создаёт другую среду, а не переносит старые данные. Предыдущие раскладки PostgreSQL требуют инвентаризации и плана восстановления — см. [Deployment](docs/DEPLOYMENT.md).

### Что происходит при запуске

Docker собирает development-образ с зависимостями из lockfile. PostgreSQL и ClamAV должны пройти health checks, затем приложение выполняет миграции и запускает Next.js. При ошибке миграций сайт не запускается. Seed автоматически не выполняется: первоначальная база не содержит демонстрационных аккаунтов и публикаций.

Приложение работает не от root. Только его порт опубликован на `127.0.0.1`; база и ClamAV не публикуют порты на компьютер. Данные и файлы находятся в отдельных именованных томах. Проверка готовности приложения проверяет `/api/health` с доступом к БД и чтение/запись в `/data/uploads`.

Это режим разработки с локальными тестовыми реквизитами, **не конфигурация для размещения в интернете**. Production использует отдельный `compose.production.yaml`; его проверки HTTPS, секретов и обязательного scanner не ослаблены.

### Проверка, журналы и остановка

```bash
docker compose -p nexus-local -f compose.yaml ps
docker compose -p nexus-local -f compose.yaml logs --tail 100 app postgres clamav
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
```

Остановить локальные контейнеры, сохранив именованные тома:

```bash
docker compose -p nexus-local -f compose.yaml down
```

Для повторного запуска или применения изменённого кода повторите команду `up --build` выше. Исходники включены в образ; автоматическая синхронизация файлов с компьютера пока не настроена. Не добавляйте `--volumes` к остановке и не используйте очистку томов для исправления ошибок запуска.

Если порт 3000 занят, задайте `NEXUS_DEV_PORT=3001` в локальном `.env`, не перезаписывая другие настройки, и повторите запуск. Адрес станет `http://localhost:3001`. При ошибке readiness сначала смотрите журналы: запуск ClamAV, миграции, доступ к базе и права на файлы.

Подробнее о проверках и правилах изменений: [Development](docs/DEVELOPMENT.md).

## Implemented foundation to verify for closed beta

- PostgreSQL-backed registration, login, sessions, and authorization;
- live server directory driven by the official MTA master-list;
- owner-scoped editorial server profiles and verification workflow, without a server agent;
- free resources, private builds, SHA-256 integrity, library claims, and entitlement-gated downloads;
- articles, profiles, follows, notifications, reports, and moderation foundations.

These are implementation areas, not a claim that every end-to-end journey has passed. Startup and health checks do not prove upload scanning, account recovery, UI usability, authorization journeys, or production readiness.

## Explicitly not available

Paid checkout, spendable balances, payouts, refunds and crypto settlement remain disabled. The S3 adapter, verified production email/recovery flow, shared multi-instance rate limiting, and MTA server-side installation are not available. Local email is disabled. Existing environments and backup restoration remain unverified.

## Stack

Node.js 26 / pnpm 12; Next.js 16 / React 19 / TypeScript 7; PostgreSQL 18 / Drizzle; Vitest 5. Exact dependency resolutions are in `pnpm-lock.yaml`; this change does not upgrade dependencies.

## Branch policy

`dev` contains small development changes. `main` contains reviewed release history, but a commit being present there does not mean it was deployed or accepted for users. Promote reviewed changes through a pull request. Release only an explicitly approved SHA/tag from `main` after the [release gates](docs/RELEASE-READINESS.md) pass. Never force-reset a branch merely to synchronize its appearance.

## Documentation

- [Release map and next tasks](docs/RELEASE-READINESS.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Product Blueprint](docs/PRODUCT-BLUEPRINT.md)
- [Implementation roadmap — not release evidence](docs/AUTONOMOUS-EXECUTION-ROADMAP.md)
- [Foundation audit](docs/FOUNDATION-AUDIT.md)
- [Legacy migration map](docs/LEGACY-MIGRATION-MAP.md)
- [Deployment guide — validation required](docs/DEPLOYMENT.md)

MTA Nexus is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.
