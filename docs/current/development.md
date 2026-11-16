# Разработка: запуск, ветки и вклад

**verified_at:** 16 ноября 2026 (Europe/Moscow).  
**Назначение:** поднять локальный контур, понять ветки `dev`/`main` и пройти минимальные проверки перед отправкой. Операторские markers и полный runbook — в [`docs/OPERATIONS.md`](../OPERATIONS.md) (authoritative). Контракт исполнителя — корневой [`AGENTS.md`](../../AGENTS.md) и [`docs/AGENT.md`](../AGENT.md).

## Ветки

Постоянные ветки только две:

1. `dev` — интеграция: сюда коммиты разработки и Dependabot.
2. `main` — линия выпуска: обновляется PR `dev` → `main` после зелёного CI.

Прямой push в `main` блокируется ruleset (обязателен статус `CI result`). Других долгоживущих веток не ведите.

Коммиты: `type(scope): result` на английском, одна логическая задача.

## Предусловия

- Docker и Docker Compose.
- Node.js `26.11.1` (`.nvmrc`) и pnpm `12.4.2` (`package.json#packageManager`).
- Разница major-ok / exact pin — в OPERATIONS §1.

## Получить код и зависимости

```sh
git checkout dev
git pull --ff-only
git status
pnpm install --frozen-lockfile
```

## Окружение

Для полного Compose-стека `docker/.env` необязателен: без копии стек работает на безопасных dev-дефолтах из `docker/compose.yaml`. Если нужны свои значения:

```sh
test ! -e docker/.env && cp config/env/.env.example docker/.env
```

При обновлении со старым `deploy/.env` сохраните значения: перенесите проверенный файл в `docker/.env` либо задайте `COMPOSE_ENV_FILES`. Не заменяйте рабочий env шаблоном.

```sh
pnpm nexus:doctor
```

## Запуск

```sh
pnpm dev                        # полный Compose-стек
pnpm dev:docker:check           # readiness app + worker liveness
```

Приложение: **http://127.0.0.1:3000**. Демо-каталог:

```sh
docker compose -p nexus-local -f docker/compose.yaml exec \
  -e NEXUS_DEMO_SEED_ACK=development-only app pnpm db:seed
```

`pnpm dev:host` — только Next.js при уже доступных Postgres/storage/scanner снаружи.

## Проверить изменение

```sh
pnpm check:code                  # format, lint, types, boundaries, unused, unit + tooling
pnpm docs:check                  # локальные Markdown-ссылки и якоря
pnpm test:focus path/to/file.test.ts
```

DB-тесты требуют `DATABASE_URL` на disposable БД (см. OPERATIONS).

## Отправка и PR

1. Коммитьте в `dev`.
2. Дождитесь CI на push в `dev`.
3. Откройте PR `dev` → `main` и дождитесь `CI result`.
4. Merge, push, production deploy и смена GitHub settings — только по прямому указанию владельца.

## Ожидаемый результат и ошибки

| Шаг                    | Ожидание                      | Если иначе                                                |
| ---------------------- | ----------------------------- | --------------------------------------------------------- |
| `nexus:doctor`         | exit 0, pins совпадают        | Исправьте Node/pnpm/Docker/порт по сообщению doctor       |
| `pnpm dev`             | app на :3000, compose healthy | Смотрите `docker compose … logs`; не ослабляйте readiness |
| `check:code`           | exit 0                        | Читайте Biome/tsc/knip/depcruise вывод; не bypass CI      |
| Push в `main` отклонён | Норма без PR                  | Работайте через `dev`                                     |

## Связанный контекст

- Состояние продукта: [`system.md`](system.md).
- Открытые ограничения: [`../issues/constraints.md`](../issues/constraints.md).
- Карта репозитория (пока): [`../PROJECT-MAP.md`](../PROJECT-MAP.md).
