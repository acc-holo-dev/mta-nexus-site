# Топология кода: AS-IS scoreboard и TO-BE читаемость

**measured_at:** 16 ноября 2026 (Europe/Moscow).  
**source_sha:** `ed9c4a83` (`dev`, support-center test relocate slice 20).  
**Машинный снимок:** [`planning/code-topology-counts.json`](../../planning/code-topology-counts.json).  
**Регенерация:** `python3 planning/tools/inventory_code_topology.py --output planning/code-topology-counts.json`  
**Проверка drift:** `python3 planning/tools/inventory_code_topology.py --check planning/code-topology-counts.json` (git-tracked counts; `source_sha` информативный)

Этот документ — живая карта **внутренней** топологии после foundation-переноса `apps/web` → `site/`. Перенос путей уже сделан; цель программы — читаемость модулей 2027 (features владеют UI/composition, `lib/` и `components/` сжимаются). Слои и depcruise: [`ARCHITECTURE.md`](../ARCHITECTURE.md). Навигация пакетов: [`PROJECT-MAP.md`](../PROJECT-MAP.md).

Счётчики — факт checkout на `source_sha`, не обещание готовности beta/production.

## AS-IS дерево (runtime)

```text
site/
├── src/
│   ├── app/                 # App Router + HTTP adapters (282× route.ts)
│   ├── features/            # feature-группировка (11 доменов, incl. shell/)
│   ├── components/          # корневой UI вне features (сжимается после shell absorb)
│   └── lib/                 # плоский helpers + services/ + i18n/
│       ├── services/        # 86 оркестраторов в одном каталоге
│       └── i18n/            # общий locale primitive
└── packages/                # канонические @nexus/* (workspace)
    ├── ui/ domain/ db/ validation/ security/ storage/ config/
```

Корневые `packages/*` и `apps/web` **не** в `pnpm-workspace.yaml` и **не** в Git: локальные пустые husks после переноса (см. § Husks). Workspace: только `site` + `site/packages/*`.

## Counts (HEAD inventory)

| Область                    | Факт на `ed9c4a83` |
| -------------------------- | -----------------: |
| `features/*` domains       |                 11 |
| `components/` tree files   |                 46 |
| `components/` root files   |                 41 |
| `lib/` tree files          |                410 |
| `lib/` root files          |                297 |
| `lib/services/` root files |                 86 |
| `lib/**/*-i18n.ts`         |                 46 |
| `app/**/route.ts`          |                282 |
| `site/tests` files         |               1450 |
| `@nexus/ui` src files      |                 18 |
| `@nexus/domain` src files  |                 54 |
| `@nexus/db` src files      |                201 |

### Features

| Feature       | files |  bytes |
| ------------- | ----: | -----: |
| accounts      |    13 |  57526 |
| community     |    80 | 387796 |
| discovery     |     3 |  20342 |
| library       |    57 | 283753 |
| moderation    |    14 |  63538 |
| notifications |    10 |  66532 |
| organizations |    35 | 127334 |
| resources     |    93 | 447532 |
| servers       |    54 | 218715 |
| shell         |    43 |  83966 |
| support       |    14 |  71877 |

Эталон границ: [`features/servers/README.md`](../../site/src/features/servers/README.md) (`client` / `server` / `model` + server-only ports, без прямого импорта внутренностей снаружи).

### Hotspots `lib/` root (по префиксу имени)

| prefix       | files |
| ------------ | ----: |
| resource     |    50 |
| server       |    27 |
| library      |    23 |
| organization |    15 |
| community    |    12 |
| license      |    10 |
| public       |     9 |
| support      |     9 |
| build        |     8 |
| notification |     8 |
| content      |     6 |
| discussion   |     6 |

### Shell / auth leftovers в `components/` root

**Slice 4 done:** nav/footer/chrome — [`features/shell`](../../site/src/features/shell/README.md) (`shell`, `navbar`, `footer`, `sidebar`).

**Slice 8 done:** `locale-context` → [`features/shell/locale.ts`](../../site/src/features/shell/locale.ts) (`LocaleProvider`, `useNexusLocale`); depcruise isolation exceptions для cross-feature locale.

**Slice 9 done:** session helpers → [`features/shell/session.ts`](../../site/src/features/shell/session.ts) и [`auth-session.ts`](../../site/src/features/shell/auth-session.ts) (`session/*`: payload, refresh, destination policy, `useAuthSession`); порт `session` в accounts isolation; depcruise public API + client graphs.

**Slice 10 done:** `auth-return-path` → [`features/shell/auth-return.ts`](../../site/src/features/shell/auth-return.ts) (`parseAuthReturnPath`, `resolveAuthReturnPath`, `authEntryHref`, `currentBrowserReturnPath`); depcruise public API + cross-feature client isolation (как locale/session).

**Slice 11 done:** guest-auth / platform sign-in → [`features/shell/guest-auth.ts`](../../site/src/features/shell/guest-auth.ts) (`GuestAuthLinks`, `PlatformSignIn`, `PlatformGuestAuthPanel`, workspace copy/links); depcruise public API + cross-feature client isolation (как auth-return).

**Slice 12 done:** platform session recovery UI → [`features/shell/session-error.ts`](../../site/src/features/shell/session-error.ts) (`PlatformSessionError`); depcruise public API + cross-feature client isolation (как auth-return); `clientUtilPorts` без `"use client"`.

**Slice 13 done:** `use-modal-dialog` → [`features/shell/modal-dialog.ts`](../../site/src/features/shell/modal-dialog.ts) (`useModalDialog`, `clickedDialogBackdrop`); depcruise public API + cross-feature client isolation (как session-error); порт с `"use client"`, вне `clientUtilPorts`.

**Slice 14 done:** home personal changes UI → [`features/shell/home-personal.ts`](../../site/src/features/shell/home-personal.ts) (`HomePersonalChangesPanel`, heading/scope ids, `HomePersonalCopy`); `lib/home-personal-changes*` вне scope; depcruise public API + cross-feature client isolation (как modal-dialog); порт без `"use client"` (server panel + client opt-out внутри).

**Slice 17 done:** `pwa-service-worker` → [`features/shell/pwa-service-worker.ts`](../../site/src/features/shell/pwa-service-worker.ts) (`PwaServiceWorker`); depcruise public API + cross-feature client isolation (как modal-dialog); порт с `"use client"`; единственный потребитель — `app/layout.tsx`.

**Slice 18 done:** `object-mute-controls` → [`features/community/object-mute-controls.ts`](../../site/src/features/community/object-mute-controls.ts) (`ObjectMuteControls`); follow/mute UI under Community; depcruise public API + client isolation (как `reactions`).

**Slice 19 done:** `follow-button` / `follow-workspace` → [`features/community/follow.ts`](../../site/src/features/community/follow.ts) (`FollowButton`, `FollowWorkspace`); depcruise public API + client isolation (как `object-mute-controls`); импорты shell auth-return/guest-auth и `object-mute-controls` внутри feature.

### Accounts / workspace leftovers в `components/` root

**Slice 15 done:** `context-switcher` → [`features/accounts/context.ts`](../../site/src/features/accounts/context.ts) (`ContextSwitcher`); depcruise public API + accounts client isolation (как settings); порт с `"use client"`.

**Slice 16 done:** orphan suites `notification-bell*.test.tsx` → [`site/tests/database/`](../../site/tests/database/) (effects, identity, interaction suites рядом с [`notification-bell-preview-surface.test.tsx`](../../site/tests/database/notification-bell-preview-surface.test.tsx)); корень `components/` теряет 6 не-production файлов; импорты по конвенции `tests/database` (`../../src/features/...`, harness в `tests/helpers/`).

**Slice 20 done:** orphan [`support-center.test.tsx`](../../site/tests/database/support-center.test.tsx) → [`site/tests/database/`](../../site/tests/database/) (localization для staff/requester filters рядом с [`support-activity-shells-honesty-surface.test.tsx`](../../site/tests/database/support-activity-shells-honesty-surface.test.tsx)); корень `components/` теряет ещё один не-production файл; потребитель — публичный порт [`features/support/center.ts`](../../site/src/features/support/center.ts).

Cross-feature shell/chrome leftovers в `components/` root: **cleared** (после slice 13).

**Slice 5 done:** shell+home hard-coded string inventory — [`planning/shell-home-hardcoded-strings.json`](../../planning/shell-home-hardcoded-strings.json).  
Регенерация: `python3 planning/tools/inventory_shell_home_i18n.py --output planning/shell-home-hardcoded-strings.json`  
Проверка: `python3 planning/tools/inventory_shell_home_i18n.py --check planning/shell-home-hardcoded-strings.json`  
Scope: `features/shell` (без тестов), `app/page.tsx`, home panels, `app/layout.tsx` metadata, `@nexus/ui` BrandMark. Brand / unknown-marker literals живут в allowlist; `locale === "ru"|"en" ? "copy" : "copy"` в scope должен оставаться **0**. Новые не-allowlisted литералы валят plan CI.

**Slice 6 done:** sidebar chrome uses shared `@nexus/ui` `BrandMark` (collapsed tile-only, expanded wordmark + locale `openFreeBeta` tag); duplicate `brand.sidebar.*` literals removed from shell inventory allowlist.  
**Slice 7 done:** footer credit line moved to `dictionary.footer.creditLine` (en/ru); inventory allowlist no longer tracks footer copyright glue.

## TO-BE (цель читаемости)

```text
site/src/
├── app/                      # только routing, metadata, thin HTTP adapters
├── features/
│   ├── shell/                # navbar, footer, locale, guest/member nav
│   ├── accounts/ discovery/ servers/ resources/ …
│   └── trust/                # при необходимости отдельно от moderation
├── lib/
│   ├── services/<domain>/    # оркестрация по доменам (не 86 файлов в корне)
│   ├── http/                 # browser adapters
│   └── platform/             # locale primitives / shared non-UI
└── (components/ → опустошать; новый UI только в feature или @nexus/ui)

site/packages/ui/             # tokens, typography, motion, layout, form controls
```

## Правила поглощения (structural slice)

1. Каждый slice **уменьшает** число файлов в корне `lib/` или `components/` (или явно удаляет дубль), сохраняя поведение.
2. Публичный API feature — через entrypoints + README; прямой импорт `components/` / `model/` / `server/` извне feature запрещён (depcruise + feature suites).
3. HTTP не обходит service; packages не импортируют app; UI не тянет server packages; domain независим.
4. Запрещён «переезд ради переезда» без удаления сложности и без focused proof на риск.
5. RU+EN на touched surfaces; silent fail / «0 вместо unknown» не вводить.

## Husks (quarantine)

| Путь                 | Git           | Workspace      | Quarantine                      |
| -------------------- | ------------- | -------------- | ------------------------------- |
| `site/packages/*`    | tracked       | member (канон) | keep                            |
| `packages/{ui,db,…}` | **untracked** | нет            | root `.gitignore`: `/packages/` |
| `apps/web`           | **untracked** | нет            | root `.gitignore`: `/apps/`     |

JSON inventory фиксирует только git/workspace факты (portable для CI). Корневые leftovers после `apps/web` → `site/` игнорируются Git, чтобы случайно не закоммитить пустые husks. Не удалять `site/packages`. Хостовые каталоги можно снести вручную (`rm -rf packages apps`); workspace от этого не зависит.

## Tracker и очередь программы

Живой backlog ID в [`planning/tasks.json`](../../planning/tasks.json) заморожен схемой `DOC|OPS|FLOW|UX|GROW`-NN и import-baseline (83 карточки). **Новые TOPO/UI ID в JSON сейчас нельзя** без отдельного расширения схемы + baseline — это не второй markdown-backlog: очередь внутренней топологии ведётся здесь до schema expansion.

Live tracker на момент измерения: 19 карточек, почти все `needs_decision` / `external_gate` / `deferred` (OPS/UX ads/GROW). Локальная программа topology/shell/i18n **не** ждёт OPS-17.

### Очередь slices (program control)

| #   | Slice                                                      | Ось                              | Статус   |
| --- | ---------------------------------------------------------- | -------------------------------- | -------- |
| 1   | Topology scoreboard (этот документ + inventory)            | скорость разработки / понятность | **done** |
| 2   | Husk & import honesty (`/packages/`, `/apps/` gitignore)   | babysitting tax                  | **done** |
| 3   | Design direction + `@nexus/ui` tokens/primitives           | shell 2027                       | **done** |
| 4   | Structural absorb #1 — shell nav/footer → `features/shell` | читаемость + путь гостя          | **done** |
| 5   | i18n inventory automation (shell+home hard-coded strings)  | честность RU/EN                  | **done** |
| 6   | Sidebar BrandMark absorb (drop duplicate brand literals)   | brand honesty + guest path       | **done** |
| 7   | Footer credit line → `footer.creditLine` i18n              | честность RU/EN                  | **done** |

Дальше чередовать T (topology) → A/B (shell/i18n) → C (journey honesty) → D/E (tests/docs); F только как локальный ops prep.

## Связанные входы

- Архитектура и исключения depcruise: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
- Карта пакетов и features: [`docs/PROJECT-MAP.md`](../PROJECT-MAP.md)
- CI scopes: [`docs/current/quality.md`](quality.md)
- Исторический foundation-перенос: [`docs/STRUCTURE-REFACTORING.md`](../STRUCTURE-REFACTORING.md) / archive migrations
- Path inventory (legacy terms): `planning/tools/inventory_structure.py`
