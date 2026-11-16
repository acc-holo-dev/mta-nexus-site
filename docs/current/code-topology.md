# Топология кода: AS-IS scoreboard и TO-BE читаемость

**measured_at:** 16 ноября 2026 (Europe/Moscow).  
**source_sha:** `f3be421f` (`dev` / merge #1186).  
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
│   ├── features/            # частичная feature-группировка (10 доменов)
│   ├── components/          # корневой UI вне features (84 файла в корне)
│   └── lib/                 # плоский helpers + services/ + i18n/
│       ├── services/        # 86 оркестраторов в одном каталоге
│       └── i18n/            # общий locale primitive
└── packages/                # канонические @nexus/* (workspace)
    ├── ui/ domain/ db/ validation/ security/ storage/ config/
```

Корневые `packages/*` и `apps/web` **не** в `pnpm-workspace.yaml` и **не** в Git: локальные пустые husks после переноса (см. § Husks). Workspace: только `site` + `site/packages/*`.

## Counts (HEAD inventory)

| Область                    | Факт на `f3be421f` |
| -------------------------- | -----------------: |
| `features/*` domains       |                 10 |
| `components/` tree files   |                 89 |
| `components/` root files   |                 84 |
| `lib/` tree files          |                410 |
| `lib/` root files          |                297 |
| `lib/services/` root files |                 86 |
| `lib/**/*-i18n.ts`         |                 46 |
| `app/**/route.ts`          |                282 |
| `site/tests` files         |               1443 |
| `@nexus/ui` src files      |                 18 |
| `@nexus/domain` src files  |                 54 |
| `@nexus/db` src files      |                201 |

### Features

| Feature       | files |  bytes |
| ------------- | ----: | -----: |
| accounts      |    11 |  51952 |
| community     |    75 | 357421 |
| discovery     |     3 |  20342 |
| library       |    57 | 284219 |
| moderation    |    14 |  63598 |
| notifications |    10 |  66606 |
| organizations |    35 | 127517 |
| resources     |    93 | 448089 |
| servers       |    54 | 218921 |
| support       |    14 |  72003 |

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

Кандидаты на поглощение в `features/shell` или accounts (не полный список):  
`navbar.tsx`, `footer.tsx`, `footer-contribute.tsx`, `mobile-nav.tsx`, `sidebar.tsx`, `nexus-shell.tsx`, `shell-*.ts(x)`, `locale-switcher.tsx`, `locale-context.tsx`, `guest-auth-links.tsx`, `platform-*-auth*.tsx`, `auth-return-path.ts`, `use-auth-session.ts`.

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

## Husks (следующий structural шаг)

| Путь                 | Git           | Workspace      |
| -------------------- | ------------- | -------------- |
| `site/packages/*`    | tracked       | member (канон) |
| `packages/{ui,db,…}` | **untracked** | нет            |
| `apps/web`           | **untracked** | нет            |

JSON inventory фиксирует только git/workspace факты (portable для CI). Локальные пустые деревья на хосте после переноса **могут** существовать и различаться между машинами — их не кладём в snapshot. Следующий slice: quarantine/gitignore этих leftovers **без** поломки workspace. Не удалять `site/packages`.

## Tracker и очередь программы

Живой backlog ID в [`planning/tasks.json`](../../planning/tasks.json) заморожен схемой `DOC|OPS|FLOW|UX|GROW`-NN и import-baseline (83 карточки). **Новые TOPO/UI ID в JSON сейчас нельзя** без отдельного расширения схемы + baseline — это не второй markdown-backlog: очередь внутренней топологии ведётся здесь до schema expansion.

Live tracker на момент измерения: 19 карточек, почти все `needs_decision` / `external_gate` / `deferred` (OPS/UX ads/GROW). Локальная программа topology/shell/i18n **не** ждёт OPS-17.

### Очередь slices (program control)

| #   | Slice                                                            | Ось                              | Статус                           |
| --- | ---------------------------------------------------------------- | -------------------------------- | -------------------------------- |
| 1   | Topology scoreboard (этот документ + inventory)                  | скорость разработки / понятность | **done** на `f3be421f` inventory |
| 2   | Husk & import honesty (`packages/*`, `apps/web` local leftovers) | babysitting tax                  | next                             |
| 3   | Design direction + `@nexus/ui` tokens/primitives                 | shell 2027                       | queued                           |
| 4   | Structural absorb #1 — shell nav/footer → `features/shell`       | читаемость + путь гостя          | queued                           |
| 5   | i18n inventory automation (shell+home hard-coded strings)        | честность RU/EN                  | queued                           |

Дальше чередовать T (topology) → A/B (shell/i18n) → C (journey honesty) → D/E (tests/docs); F только как локальный ops prep.

## Связанные входы

- Архитектура и исключения depcruise: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
- Карта пакетов и features: [`docs/PROJECT-MAP.md`](../PROJECT-MAP.md)
- CI scopes: [`docs/current/quality.md`](quality.md)
- Исторический foundation-перенос: [`docs/STRUCTURE-REFACTORING.md`](../STRUCTURE-REFACTORING.md) / archive migrations
- Path inventory (legacy terms): `planning/tools/inventory_structure.py`
