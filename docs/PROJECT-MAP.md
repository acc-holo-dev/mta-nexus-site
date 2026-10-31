# Карта проекта MTA NEXUS

Компактная навигация по репозиторию для людей и агентов. Политика слоёв — в [архитектуре](ARCHITECTURE.md); команды — в [эксплуатации](OPERATIONS.md); предметные главы — в [карте областей](handbook/15-AI-CONTEXT-INDEX.md). При расхождении со спецификацией доверяйте коду, миграциям и выполненным проверкам.

## Стек (факт кода)

| Слой | Версия / выбор |
| ---- | -------------- |
| Runtime | Node.js 26.10.0 (`.nvmrc`), pnpm 12.4.2 |
| App | Next.js 16.4 + React 19.3 в `apps/web` (Turbopack default; `build:webpack` запасной) |
| UI | Tailwind CSS 4, `@nexus/ui`, токены `globals.css`, RU/EN |
| Data | PostgreSQL 18, Drizzle ORM, forward-only SQL migrations |
| Quality | Biome, TypeScript 7, Vitest 5 (проекты `unit` / `database`), Knip, dependency-cruiser |
| Dev stack | Docker Compose (`compose.yaml`): app, PostgreSQL, ClamAV, push-worker |
| CI | GitHub Actions path-scoped gates + browser/axe smoke; не Turbo monorepo |

Модульный монолит на одной инстанции. Redis, внешние очереди и микросервисы не входят в текущую форму без измеренной необходимости.

## Пакеты и приложение

```
apps/web          → страницы App Router, HTTP API, UI, lib/services (~75 сервисов)
packages/domain   → чистые типы/ошибки/правила (не зависит от остальных пакетов)
packages/validation → Zod/схемы входа
packages/security → сессии, authz, идентификаторы, лимиты
packages/db       → schema, migrations (~87 SQL), repositories (~170), workers
packages/storage  → приватные артефакты и целостность
packages/config   → проверка env
packages/ui       → общие UI-примитивы без серверных импортов
tests/            → HTTP/UI/поведенческие Vitest-сюиты (~6MB)
scripts/          → doctor, CI policy, browser/axe, release/beta evidence
```

Граница: HTTP → services → domain/validation → repositories. Пакеты не импортируют `apps/web`.

## Основные продуктовые поверхности

| Область | Где смотреть |
| ------- | ------------ |
| Auth / Security Center | `auth-service`, `packages/security`, workspace settings |
| Servers / directory | `mta-master-directory-service`, `server-*`, `/servers` |
| Resources / builds / scan | `product-service`, `build-*`, ClamAV, `/market`, workspace resources |
| Library / collections | `library-*`, `/workspace/library` |
| Community / content | `content-service`, discussions, `/community`, articles |
| Orgs / teams | `organization-*`, `/workspace/organizations` |
| Moderation / trust | reports, verification, admin queues |
| Notifications / PWA | inbox services, push worker, mail worker (optional Mailpit) |
| Commerce shell | cart/checkout/orders **без** реальных платежей (closed beta) |

## Запуск и проверки (кратко)

| Цель | Команда |
| ---- | ------- |
| Full local stack | `pnpm dev` / `pnpm dev:docker:up` → `pnpm dev:docker:check` |
| Host Next only | `pnpm dev:host` (внешние Postgres/storage/scanner) |
| Mail capture | `pnpm dev:mail` |
| Code gate (no Docker) | `pnpm check:code` |
| Focused tests | `pnpm test:focus path/to/file.test.ts` |
| Disposable DB suite | `pnpm test:isolated` (нужен Docker stack; unit без APP_URL, database с APP_URL) |
| Local disposable verify | `NEXUS_LOCAL_VERIFY=true` + `scripts/check-local-verification.sh` → `compose.verify.yaml` (зеркало CI: unit / database / build) |
| Docs links | `pnpm docs:check` |
| Release evidence | `pnpm release:verify` (не deploy; Vitest через `run-ci-aligned-vitest.mjs`) |

Preflight: `pnpm nexus:doctor` (также `dev:preflight`).

## CI контуры

`scripts/ci-policy.mjs` выбирает scope по изменённым путям: `documentation` → `unit_ci` → `fast_ci` → `full_acceptance`. Полный контур включает database, production image, browser smoke (axe WCAG A/AA), Compose startup, backup/restore rehearsal. Отдельные workflow: auth/directory/resource browser, discussion recovery.

### CI install cache (проверено)

Jobs that run `pnpm install --frozen-lockfile` (`unit`, `verify`, `mail-worker`) use this order and keep it:

1. `pnpm/action-setup@v6` (pnpm 12.4.2)
2. `actions/setup-node@v7` with `node-version-file: .nvmrc` and `cache: pnpm`
3. `pnpm install --frozen-lockfile`

Jobs that only need Node for scripts or isolated browser tool installs (`plan`, `smoke`, `postgres-persistence`, `summary`, browser workflows) correctly **omit** `cache: pnpm` — they do not install the workspace. Optional extra `pnpm cache path` metadata caching is deferred until install time is measured on CI; do not share writable stores across untrusted fork jobs.

Unit timing helper: after `pnpm test:unit`, run `node scripts/summarize-unit-timings.mjs`. Measured host snapshot and slow-file list: [PROBLEMS](PROBLEMS.md#проверки-и-сопровождение).

## Где не искать «магических» ускорителей

- Нет корневого Turbo/`turbo.json`: оркестрация — pnpm scripts + Compose + CI policy.
- Database Vitest: `maxWorkers: 1`, `isolate: true` — намеренно из‑за Proxy-моков клиента БД; ускорять только после замеров ([PROBLEMS](PROBLEMS.md)).
- Платежи/payout/DRM: утверждённая цель, не runtime closed beta.

## Документы по роли

| Нужно | Открыть |
| ----- | ------- |
| Правила агента | [AGENTS.md](../AGENTS.md) |
| Слои и безопасность | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Команды и ops | [OPERATIONS.md](OPERATIONS.md) |
| Открытые ограничения | [PROBLEMS.md](PROBLEMS.md) |
| Решения владельца | [13-DECISION-REGISTER.md](handbook/13-DECISION-REGISTER.md) |
| Очередь beta | [10-ROADMAP.md](handbook/10-ROADMAP.md) |
| Предметная глава | [15-AI-CONTEXT-INDEX.md](handbook/15-AI-CONTEXT-INDEX.md) |
