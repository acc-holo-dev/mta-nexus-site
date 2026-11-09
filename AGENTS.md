# MTA NEXUS — правила для исполнителя

> Это контракт агента: обязательные правила поведения исполнителя. Рабочий вход — [docs/AGENT.md](docs/AGENT.md).

1. Начните с [docs/AGENT.md](docs/AGENT.md). Там находятся порядок выбора задачи, границы изменений, проверки и формат результата. Не читайте весь handbook перед каждой задачей.
2. Указания владельца имеют приоритет. Сохраняйте его незакоммиченные изменения. Работайте в существующем checkout; отдельный worktree создавайте только по запросу.
3. Реальное поведение подтверждают код, миграции и выполненные проверки на конкретном SHA. Цель, готовая спецификация, PASS в CI и включение в production — разные состояния.
4. Самостоятельно завершайте разрешённые обратимые технические задачи. Отправка изменений в GitHub требует прямого указания владельца в текущей или предыдущей части сессии. Уже полученное разрешение повторно не запрашивайте. Push или release сами по себе не разрешают production deploy, разрушительные операции с данными либо реальные платежи.
5. Назначайте параллельным исполнителям непересекающиеся файлы. Основной агент отвечает за общие контракты, интеграцию, проверки и внешнюю отправку. Полные наборы проверок не запускайте отдельно для каждого исполнителя; тяжёлые unit/DB/build-прогоны на ограниченном хосте выполняйте последовательно.
6. История выполненной работы живёт в Git и проверяемых результатах CI. Не создавайте параллельные журналы передачи или несколько вручную поддерживаемых копий backlog.

**Языки:** контракты и большинство `docs/` — русский; `OPERATIONS.md` — English-first и authoritative для команд; код, коммиты и CI — английский; интерфейс — RU/EN. Из языка файла не выводите его важность.

Архитектура вкратце: HTTP разбирает запрос и для составных изменений вызывает service; простые read/health → `@nexus/db` допустимы только из списка в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) / `.dependency-cruiser.exceptions.cjs`. Пакеты не импортируют apps; domain независим; UI не тянет server packages. Версия приложения и toolchain pins — [OPS/OPERATIONS](docs/OPERATIONS.md); major-ok (`engines`) и exact pin (`.nvmrc` / `packageManager`) — разные проверки.

Краткая навигация при необходимости: [карта проекта](docs/PROJECT-MAP.md), [текущее состояние](docs/CURRENT-STATE.md), [решения](docs/DECISIONS.md) и полный baseline ID в [реестре](docs/handbook/13-DECISION-REGISTER.md), [эксплуатация](docs/OPERATIONS.md), [проблемы](docs/PROBLEMS.md), [roadmap](docs/ROADMAP.md).

## Cursor Cloud specific instructions

- Node.js `26.11.1` is managed via nvm (default alias; `~/.nvm/versions/node/v26.11.1/bin`); pnpm `12.4.2` is installed system-wide (`/usr/bin/pnpm`). `/exec-daemon/node` is Node 22 and is not the project runtime. If `node -v` is not 26, run `nvm use` in the project directory (`.nvmrc`) to select the pinned runtime.
- There is no systemd. The environment start script launches `dockerd`, sets `iptables-legacy` FORWARD to ACCEPT (user-defined Compose networks cannot reach Postgres without that), then runs `docker compose -p nexus-local -f deploy/compose.yaml up --detach --wait`. The app is `http://127.0.0.1:3000`.
- Readiness: `sudo docker compose -p nexus-local -f deploy/compose.yaml exec -T app node scripts/check-local-readiness.mjs`. Demo catalog: `sudo docker compose -p nexus-local -f deploy/compose.yaml exec -T -e NEXUS_DEMO_SEED_ACK=development-only app pnpm db:seed`. The development password is the one hashed in `packages/db/src/seed.ts`.
- Run `pnpm test:unit` without `NEXT_PUBLIC_APP_URL`. Host checks that do not need Docker: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`.
