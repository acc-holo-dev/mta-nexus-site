# Топология кода: AS-IS scoreboard и TO-BE читаемость

**measured_at:** 17 ноября 2026 (Europe/Moscow).  
**source_sha:** `f34af2a5` (`dev`, slice 33 — `order-*` cluster → `features/commerce` order ports).  
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
│   ├── features/            # feature-группировка (13 доменов, incl. shell/)
│   ├── components/          # корневой UI вне features (сжимается после shell absorb)
│   └── lib/                 # плоский helpers + services/ + i18n/
│       ├── services/        # 86 оркестраторов в одном каталоге
│       └── i18n/            # общий locale primitive
└── packages/                # канонические @nexus/* (workspace)
    ├── ui/ domain/ db/ validation/ security/ storage/ config/
```

Корневые `packages/*` и `apps/web` **не** в `pnpm-workspace.yaml` и **не** в Git: локальные пустые husks после переноса (см. § Husks). Workspace: только `site` + `site/packages/*`.

## Counts (HEAD inventory)

| Область                    | Факт на slice 33 |
| -------------------------- | ---------------: |
| `features/*` domains       |               13 |
| `components/` tree files   |               11 |
| `components/` root files   |               11 |
| `lib/` tree files          |              410 |
| `lib/` root files          |              298 |
| `lib/services/` root files |               86 |
| `lib/**/*-i18n.ts`         |               46 |
| `app/**/route.ts`          |              282 |
| `site/tests` files         |             1451 |
| `@nexus/ui` src files      |               18 |
| `@nexus/domain` src files  |               54 |
| `@nexus/db` src files      |              201 |

### Features

| Feature       | files |  bytes |
| ------------- | ----: | -----: |
| accounts      |    25 | 100894 |
| commerce      |    26 | 116429 |
| community     |    85 | 395262 |
| discovery     |     3 |  20343 |
| library       |    57 | 283753 |
| moderation    |    22 | 115011 |
| notifications |    10 |  66691 |
| organizations |    35 | 127293 |
| resources     |    93 | 447525 |
| servers       |    54 | 218716 |
| shell         |    49 |  87479 |
| support       |    14 |  72088 |
| trust         |     5 |  14574 |

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

**Slice 21 done:** trust-кластер в `components/` root — `report-evidence-links` → [`features/community/report-evidence-links.ts`](../../site/src/features/community/report-evidence-links.ts) (`ReportEvidenceLinks`); владение Community (report UI и admin staff queue через публичный порт); depcruise public API без `"use client"` (как `publication-feed`).

**Slice 22 done:** остаток публичного trust UI — `public-user-trust` → [`features/trust/public-user-trust.ts`](../../site/src/features/trust/public-user-trust.ts) (`PublicUserTrustPanel`), `public-context-trust-page` → [`features/trust/public-context-trust-page.ts`](../../site/src/features/trust/public-context-trust-page.ts) (`PublicContextTrustPage`, `contextTrustMetadata`); владение **Trust** (публичные сводки пользователя и контекста org/server, не staff moderation); `public-context-trust-page` server-only в `features/trust/server/`; depcruise `trust-feature-*`; trust-кластер в `components/` root **cleared**.

**Slice 23 done:** `reaction-removal` → [`features/community/reaction-removal.ts`](../../site/src/features/community/reaction-removal.ts) (`ReactionRemoval`); владение **Community** рядом с `reactions.ts` (workspace снятие реакции, confirm + API); depcruise public API + client isolation; потребитель — `app/workspace/reactions/page.tsx`.

**Slice 24 done:** `legal-document` → [`features/shell/legal-document.ts`](../../site/src/features/shell/legal-document.ts) (`LegalDocument`); владение **Shell** (публичный chrome/layout terms, privacy, copyright, community-rules); depcruise public API + client isolation (как `home-personal`); потребители — `app/{terms,privacy,copyright,community-rules}/page.tsx`; корень `components/` −1 production file.

**Slice 25 done:** `copyable-plain-code-block` → [`features/shell/copyable-plain-code-block.ts`](../../site/src/features/shell/copyable-plain-code-block.ts) (`CopyablePlainCodeBlock`); владение **Shell** (shared plain-text copy CTA, min-h-11 touch); depcruise public API + client isolation (как `pwa-service-worker`); порт с `"use client"`; потребитель — [`resource-version-help-section.tsx`](../../site/src/features/resources/components/resource-version-help-section.tsx); корень `components/` −1 production file.

**Slice 26 done:** orphan [`content-comment-form.test.ts`](../../site/tests/database/content-comment-form.test.ts) → [`site/tests/database/`](../../site/tests/database/) (форма комментария + `content-comment-client` рядом с discussion/comment suites); корень `components/` −1 не-production файл; импорты по конвенции `tests/database` (`../../src/features/community/...`, `../../src/lib/...`).

**Slice 27 done:** accounts/profile cluster в `components/` root — `public-profile-form`, `profile-privacy-editor`, `developer-profile-editor`, `profile-change-history`, `private-change-history-controls`, `profile-resource-pagination` → [`features/accounts/components/`](../../site/src/features/accounts/components/); `public-profile-activity` → [`features/accounts/server/`](../../site/src/features/accounts/server/public-profile-activity.tsx); публичные порты [`profile.ts`](../../site/src/features/accounts/profile.ts), [`change-history.ts`](../../site/src/features/accounts/change-history.ts), [`profile-pagination.ts`](../../site/src/features/accounts/profile-pagination.ts), [`public-profile-activity-server.ts`](../../site/src/features/accounts/public-profile-activity-server.ts); владение **Accounts** (settings/profile/privacy/developer + shared change-history controls для staff/community/org history); depcruise `accounts-feature-*` + cross-feature `change-history` для Community/Organizations; корень `components/` −7 production files.

**Slice 28 done:** `commerce-history-ui` → [`features/commerce/workspace-history.ts`](../../site/src/features/commerce/workspace-history.ts) (`HistoryShell`, `HistoryPagination`); владение **Commerce** (workspace purchases/licenses/sales list shell, beta notice + tab nav); depcruise `commerce-feature-*`; потребители — `app/workspace/{purchases,licenses,sales}/page.tsx`; корень `components/` −1 production file.

**Slice 29 done:** `components/admin/*` → [`features/moderation/admin-home.ts`](../../site/src/features/moderation/admin-home.ts) (`Admin*Section` for `/admin` overview: health, reports, verification, builds quarantine, ad inventory); `app/admin/status-labels` → [`lib/admin-status-labels.ts`](../../site/src/lib/admin-status-labels.ts); владение **Moderation** (staff dashboard composition + cross-feature ports `community/report-evidence-links`, `resources/qa-report-actions`, `resources/quarantine-controls`); depcruise `moderation-feature-*` + `moderation-feature-boundaries.node-test.mjs`; `components/` −5 production files (`admin/` cleared).

**Slice 30 done:** `storage-maintenance-controls` → [`features/moderation/storage-maintenance.ts`](../../site/src/features/moderation/storage-maintenance.ts) (`StorageDiscoveryControls`, `StorageCleanupControls`); владение **Moderation** (staff storage discovery/cleanup на `/admin/storage`, API и services без изменений); depcruise public API + `moderation-client-isolation` для порта `storage-maintenance`; потребители — `app/admin/storage/page.tsx`, `app/admin/storage/objects/[id]/page.tsx`; корень `components/` −1 production file.

**Slice 31 done:** `license-*` cluster в `components/` root → [`features/commerce`](../../site/src/features/commerce/README.md): client port [`license-controls.ts`](../../site/src/features/commerce/license-controls.ts) (`LicenseControlPanel`, `LicenseRuntimeProbe`), server ports [`license-detail.ts`](../../site/src/features/commerce/license-detail.ts), [`license-archive.ts`](../../site/src/features/commerce/license-archive.ts), [`license-history-server.ts`](../../site/src/features/commerce/license-history-server.ts); владение **Commerce** (workspace/admin license detail, archive filters, owner/staff control panel, runtime probe); server composition в `features/commerce/server/` вне client-isolation; depcruise `commerce-feature-*` + `commerce-feature-boundaries.node-test.mjs`; корень `components/` −5 production files.

**Slice 32 done:** `subscription-*` cluster в `components/` root → [`features/commerce`](../../site/src/features/commerce/README.md): client port [`subscription-controls.ts`](../../site/src/features/commerce/subscription-controls.ts) (`SubscriptionControls`, `SubscriptionFeeEstimator`, `SubscriptionRecovery`), shared nav port [`subscription-workspace.ts`](../../site/src/features/commerce/subscription-workspace.ts) (`subscriptionNavLinkClass`, RSC-safe); владение **Commerce** (workspace subscription activate/cancel, fee estimate, intent recovery); `PlanReviewTerms` остаётся в `components/` до plan-review absorb; depcruise `commerce-feature-*` + boundary tests; корень `components/` −4 production files.

**Slice 33 done:** `order-*` cluster в `components/` root → [`features/commerce`](../../site/src/features/commerce/README.md): client ports [`order-cancellation.ts`](../../site/src/features/commerce/order-cancellation.ts) (`OrderCancellationForm`), [`order-case-forms.ts`](../../site/src/features/commerce/order-case-forms.ts) (`OrderCaseReviewForm`; create form internal), server composition [`order-case-server.ts`](../../site/src/features/commerce/order-case-server.ts) (list/detail/create pages + `orderCaseMetadata`), RSC port [`order-terms.ts`](../../site/src/features/commerce/order-terms.ts) (`OrderTermsReportView`); владение **Commerce** (purchase cancel, order cases, terms report); `action-confirm-checkbox` / `confirm-action` остаются в `components/`; depcruise `commerce-feature-*` + boundary tests; корень `components/` −4 production files.

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
