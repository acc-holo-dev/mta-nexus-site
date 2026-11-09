# MTA NEXUS — быстрый старт для людей

Короткий путь «клон → запуск → первая правка» для человека, который хочет поднять проект локально и что-то поменять. Контракты и правила для исполнителей — в [AGENT.md](AGENT.md); команды, markers и ограничения — в [эксплуатации](OPERATIONS.md) (authoritative runbook). Этот файл — только удобный маршрут, ничего не диктует заново.

Прежде чем что-то менять: читайте [CURRENT-STATE.md](CURRENT-STATE.md) (что подтверждено сейчас) и [PROBLEMS.md](PROBLEMS.md) (что ещё открыто).

## 0. Предусловия

- Docker и Docker Compose.
- Node.js `26.11.1` (см. `.nvmrc`; например через nvm) и pnpm `12.4.2` (`package.json#packageManager`).
- Точные значения и разницу major-ok / exact pin смотрите в [OPERATIONS.md §1](OPERATIONS.md#1-supported-dev-startup).

## 1. Получить код

```sh
git checkout main
git pull --ff-only
git status          # должны быть чисто, клонируйте сами если репо ещё нет
pnpm install --frozen-lockfile
```

## 2. Окружение

Для полного Compose-стека `deploy/.env` необязателен: без копии стек работает на безопасных dev-дефолтах из `deploy/compose.yaml`. Если нужны свои значения:

```sh
cp configs/env/.env.example deploy/.env
```

Проверьте окружение перед первым запуском:

```sh
pnpm nexus:doctor
```

## 3. Запуск

```sh
pnpm dev                        # полный Compose-стек (запускает dev:preflight)
pnpm dev:docker:check           # readiness app + worker liveness
```

Приложение: **http://127.0.0.1:3000**. Демо-данные (каталог):

```sh
NEXUS_DEMO_SEED_ACK=development-only pnpm db:seed
```

> Host-only Next без внешних Postgres/storage/scanner не запускайте: это `pnpm dev:host`, и он требует уже настроенные зависимости.

## 4. Изменить и проверить

После правки прогоняйте локальный код-гейт (без Docker):

```sh
pnpm check:code                  # format, lint, types, boundaries, unused, unit + tooling
pnpm docs:check                  # локальные Markdown-ссылки и якоря
```

Узкий прогон тестов модуля по одному файлу:

```sh
pnpm test:focus path/to/file.test.ts
```

Полные проверки и их когда — в README.md, таблица «Проверки», и в [OPERATIONS.md](OPERATIONS.md).

## 5. Отправить правку

Коммиты: `type(scope): result` на английском, одна логическая задача. Механика CI по изменённым путям, ветка `main`. Отправку в GitHub и мердж согласуйте с владельцем (см. [AGENTS.md](../AGENTS.md)).

## Куда дальше

- [CURRENT-STATE.md](CURRENT-STATE.md) — проверенный срез проекта.
- [PROJECT-MAP.md](PROJECT-MAP.md) — навигация по репозиторию.
- [PRODUCT.md](PRODUCT.md) — для кого и что решаем.
- [PROBLEMS.md](PROBLEMS.md) — открытые проблемы и ограничения.
- [OPERATIONS.md](OPERATIONS.md) — authoritative runbook команд и markers.