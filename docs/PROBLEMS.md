# PROBLEMS — реестр открытых проблем MTA NEXUS

Единственный реестр проблем проекта. Обновлён: 2026-09-29 (после полного
статического аудита и живого браузерного тура).

Правила реестра:

- каждая проблема имеет приоритет, описание, доказательство и следующий шаг;
- закрытая проблема удаляется из реестра в том же коммите, который её закрыл
  (история — в commit messages и CI evidence);
- проблемы не дублируются в других документах; OPERATIONS ссылается сюда.

Приоритеты: `P0` — блокер релиза, `P1` — существенная проблема качества,
`P2` — известное ограничение, требующее работы, `P3` — улучшение/гигиена.

---

## P0 — блокеры релиза

### P0-1. GitHub Actions не выполняет jobs

- **Симптом:** workflow-запуски создают jobs, но jobs содержат `steps: []` и
  завершаются до первого шага (`runner_id: 0`, пустое имя раннера). Пример:
  [run 36398395028](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/36398395028).
- **Последствие:** `main` не проходит CI-гейты (lint/typecheck/test/build),
  поэтому дрейфы кода и тестов накапливаются незамеченными — в сентябре это
  уже привело к 23 падающим тестам на `main`.
- **Владелец:** владелец репозитория (настройки GitHub недоступны из кода).
- **Следующий шаг:**
  1. проверить Actions policy, доступность hosted-раннеров, billing/quota и
     ограничения workflow-уровня в настройках репозитория/организации;
  2. восстановить исполнение jobs;
  3. перезапустить CI на точном SHA текущего `main`;
  4. включить обязательные status checks для push в `main`;
  5. проверить зависшие Dependabot PR (ветка старого PR удалена при чистке
     веток 2026-09-29 — пересоздать PR или обновить версии локально).

## P1 — существенные проблемы

### P1-1. Lint-долг: 34 ошибки по последнему полному прогону

biome 2.5.14, ошибки требуют ручных решений по группам. Два места исправлены
в `43a996f` и `60ccbd0`; текущий счёт не подтверждён новым полным прогоном.
`pnpm check` остаётся неподтверждённым, пока GitHub Actions не исполняет jobs.

**correctness/useExhaustiveDependencies (10)** — ручная проверка массивов
зависимостей (авто-фикс может изменить поведение):

- `apps/web/src/app/acquire/page.tsx:36`
- `apps/web/src/app/settings/page.tsx:167`
- `apps/web/src/components/account-controls.tsx:21`
- `apps/web/src/components/command-palette.tsx:127`
- `apps/web/src/components/context-switcher.tsx:26`
- `apps/web/src/components/mta-master-server-directory.tsx:146` (и ещё 2 в файле)
- `apps/web/src/components/notification-bell.tsx:26`
- `apps/web/src/components/server-follow-button.tsx:29`

**suspicious/noArrayIndexKey (10)** — заменить ключи по индексу на стабильные id:

- `apps/web/src/app/admin/page.tsx:482`
- `apps/web/src/app/loading.tsx:17` и `:25`
- `apps/web/src/app/market/[slug]/page.tsx:337`
- `apps/web/src/app/notifications/page.tsx:205`
- `apps/web/src/components/mta-meta-inspector-panel.tsx:328`, `:374`, `:402`
- `apps/web/src/components/server-history-panel.tsx:113`
- `packages/ui/src/platform.tsx:190`

**a11y (7 из исходных 8)** — семантические элементы/клавиатура/фокус:

- `apps/web/src/app/market/page.tsx:68` — useSemanticElements
- `apps/web/src/components/account-controls.tsx:109` — useSemanticElements
- `apps/web/src/components/command-palette.tsx:196` и `:203` — useKeyWithClickEvents
- `apps/web/src/components/command-palette.tsx:203` — noStaticElementInteractions
- `apps/web/src/components/command-palette.tsx:210` — noAutofocus
- `packages/ui/src/dialog.tsx:22` — noStaticElementInteractions

**прочее (оставшиеся записи из исходного списка):**

- `apps/web/src/app/layout.tsx:54` — noDangerouslySetInnerHtml (подтвердить
  доверенность источника HTML или вынести в константу с комментарием)
- `packages/db/src/repositories/account-mail-smtp.ts:210` —
  noControlCharactersInRegex (намеренная фильтрация control-символов SMTP —
  подавить правило с обоснованием)
- `tests/admin-aggregate-queries.test.ts:17`, `tests/remaining-moderation-queues.test.ts:23`,
  `tests/saved-profile-repositories.test.ts:15` — noThenProperty
  (переименовать `.then`-свойства тестовых объектов)

Порядок работы: отдельная задача «lint: zero errors», по группам; после каждой
группы — `pnpm check` + ручной smoke соответствующих страниц.

### P1-2. Заголовки детальных страниц (a11y/SEO)

Страница продукта получила видимый `<h1>` с названием в `30b40aa`.
Проверка остальных детальных страниц (`/servers/[slug]`, статей и профиля)
ещё не завершена; нужен один заголовок первого уровня на страницу.

- **Следующий шаг:** проверить остальные страницы и скриншоты на двух языках
  после восстановления CI и браузерных проверок.

## P2 — известные ограничения

### P2-1. Внешние ресурсы недоступны из сети владельца

`master.multitheftauto.com` (master-list) и `images.unsplash.com` (превью seed-
данных) не отвечают даже с хоста — похоже на региональную блокировку сети.
Приложение деградирует честно («directory temporarily unavailable», «Нет
превью»), но каталог выглядит пустым, а live-серверы не отображаются.

- **Следующий шаг:** подтвердить причину (региональная блокировка vs downtime);
  рассмотреть self-hosted превью (загрузка скриншотов в приватное storage) и
  прокси/зеркало для master-list в production-инфраструктуре; для dev —
  документировать ожидаемую деградацию.

### P2-2. Dev-стек хрупок к hostname (Next dev origin-checks)

Доступ к dev-приложению через не-localhost hostname (например
`nexus-local-app-1:3000` из соседнего контейнера или по IP) ломает HMR-
соединение и гидрацию целиком: React-обработчики не подключаются, формы
сабмитятся нативным GET, auth-check не выполняется. Через `localhost:3000`
всё работает. Проверено живым браузером 2026-09-29 (Chromium и Firefox).

- **Изменение:** `0d9b7c5` разрешает точный hostname контейнера в
  `next.config.mjs`; README объясняет доступ из Compose-сети.
- **Следующий шаг:** пересобрать dev-образ, проверить гидрацию и отправку форм
  через `localhost:3000` и `nexus-local-app-1:3000` в браузере. Доступ по
  произвольному IP требует отдельного явного разрешения и проверки.

### P2-3. Seed-билды не создают файлы в storage

Базовый seed создаёт записи `builds` (published/clean) без реальных файлов в
приватном storage → claim успешен, download отвечает 404
«Resource build file is not available» (поведение честное после фикса
`b33371a`, но флоу не живой). В dev-storage созданы placeholder-файлы вручную
2026-09-29 (том `nexus-local_uploads`, переживают пересоздание контейнеров).

- **Следующий шаг:** seed должен генерировать placeholder-архивы в
  `STORAGE_LOCAL_PATH` по `builds.storage_key` (idempotent), чтобы dev-флоу
  скачивания работал из чистого окружения.

### P2-4. `products.type` не ограничен CHECK-констрейнтом

В БД существует продукт с `type = 'tool'`, которого нет в TypeScript-типе
`ProductType` (script/model/vehicle/map/ui/plugin/api/service/bundle).
TS-валидация есть только на входе приложений.

- **Следующий шаг:** миграция с CHECK-констрейнтом на `products.type` +
  нормализация данных (`tool` → `plugin` или добавление типа в словарь).

### P2-5. Тестовая инфраструктура: хрупкости и производительность

- root `tests/` импортируют `next/server`, `drizzle-orm` — работает через
  root devDependencies (`ea5235c`); долгосрочно тесты стоит перенести в
  соответствующие пакеты воркспейса;
- surface-тесты сверяют точные строки исходников — ломаются при
  переформатировании; при правках предпочитать regex/поведенческие проверки;
- `fileParallelism: false` в `vitest.config.ts` (сделано ради детерминизма
  account-mail очередей) увеличил полный прогон до ~65s; при желании вернуть
  скорость — вынести mail-сьюиты в отдельный vitest-проект со своей БД;
- policy-тест документов (`tests/mainline-repository-policy.test.ts`) —
  источник правды по составу документации.

### P2-6. Хост-тулинг не соответствует engines

Хост: Node 22.23.2 / pnpm 12.4.1; проект требует Node ≥ 26 / pnpm 12.4.2.
Хост-скрипты `pnpm dev:docker:*`, `pnpm test:isolated` работают через Docker,
но host-side `pnpm check` без контейнера невозможен. pnpm-автоустановка
зависимостей при host-run создаёт лишний `node_modules` на хосте — установка
предотвращена (`verifyDepsBeforeRun: warn`).

- **Следующий шаг:** обновить хост (`nvm install 26`, corepack pnpm@12.4.2)
  либо держать разработку строго в Docker-пути.

## P3 — гигиена и улучшения

- **Админка EN-only** — словарь не покрывает `/admin`; известное ограничение
  закрытой беты (README документирует область словаря).
- **Hydration mismatch warning** от theme-инициализации (inline script читает
  `localStorage` до гидрации) — кандидат на `suppressHydrationWarning` у
  корневого `<html>`/theme-провайдера; поведение корректно.
- **Dev-БД загрязнена тестовыми данными** (~1600 пользователей, `*_mum*`
  артефакты integration-тестов) — ожидаемо для dev; для чистых прогонов
  использовать `pnpm test:isolated`; при необходимости пересоздать том
  `nexus-local_pgdata` и накатить `pnpm db:seed`.
- **Проверять «живость» сайта браузером регулярно** — скрипты живого тура
  сохранены вне репозитория (`~/nexus-ux-audit/`), запускаются контейнерным
  Chromium против `localhost:3000` (установить: `apk add chromium` в dev-контейнер,
  `npm i playwright-core` в `/tmp` контейнера).

---

## Недавно исправлено (справочно, из истории)

- `43a996f` — объявление в `switch` маршрута follow заключено в блок.
- `60ccbd0` — счётчик оценок статьи доступен через видимый текст без
  неподдерживаемого `aria-label` на обычном `div`.

- `b33371a` — claim UI принимал 201 за ошибку; download 500→404 при
  отсутствии файла; home SSR ждал 10.1s у каждого посетителя при недоступном
  master-list (добавлен failure backoff, замер: 10.08s → 0.09s).
- `ea5235c` — восстановлена детерминированная верификация: root-тесты
  резолвят `next`/`drizzle-orm`; сериализация тест-файлов и сброс disposable
  очереди убрали межфайловые гонки; `.github` возвращён в docker-контекст;
  добавлен `pnpm test:isolated`.
- 2026-09-29 — ветки GitHub почищены (остался только `main`; бэкап-бандл
  всех веток: `~/backups/mta-nexus-site-all-branches-20260929-044934.bundle`);
  Docker очищен от ресурсов других проектов (~2.8 GB).
- `a93ed14` — датированные аудиты убраны из `docs/` (policy-тест), реестр
  проблем консолидирован в этот файл.