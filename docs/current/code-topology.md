# Топология кода: AS-IS scoreboard и TO-BE читаемость

**measured_at:** 18 ноября 2026 (Europe/Moscow).  
**source_sha:** `b5ef69e9` (`dev`, после Slice 42/43 platform absorbs + residual honesty).
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
│   ├── components/          # корневой UI вне features (пуст после slice 36)
│   └── lib/                 # только каталоги: http/ + i18n/ + platform/ + services/
│       ├── http/            # browser/bounded/private/public adapters
│       ├── i18n/            # общий locale primitive
│       ├── platform/        # observability, postgres-error, offline-cache, …
│       └── services/<domain>/  # оркестраторы по доменам (services root = 0)
└── packages/                # канонические @nexus/* (workspace)
    ├── ui/ domain/ db/ validation/ security/ storage/ config/
```

Корневые `packages/*` и `apps/web` **не** в `pnpm-workspace.yaml` и **не** в Git: локальные пустые husks после переноса (см. § Husks). Workspace: только `site` + `site/packages/*`.

## Counts (HEAD inventory)

| Область                    |             Факт на `ff61b052` |
| -------------------------- | -----------------------------: |
| `features/*` domains       |                             13 |
| `components/` tree files   |                              0 |
| `components/` root files   |                              0 |
| `lib/` tree files          |                            129 |
| `lib/` root files          |                              0 |
| `lib/` root dirs           | http, i18n, platform, services |
| `lib/services/` root files |                              0 |
| `lib/**/*-i18n.ts`         |                              0 |
| `app/**/route.ts`          |                            282 |
| `site/tests` files         |                           1585 |
| `@nexus/ui` src files      |                             20 |
| `@nexus/domain` src files  |                             54 |
| `@nexus/db` src files      |                            201 |

### Features

| Feature       | files |  bytes |
| ------------- | ----: | -----: |
| accounts      |    44 | 148930 |
| commerce      |    70 | 326593 |
| community     |   127 | 584185 |
| discovery     |     7 |  32895 |
| library       |    86 | 401782 |
| moderation    |    32 | 152991 |
| notifications |    21 | 131020 |
| organizations |    49 | 185690 |
| resources     |   165 | 722595 |
| servers       |    82 | 310327 |
| shell         |    60 |  99104 |
| support       |    22 | 108927 |
| trust         |    15 |  59635 |

Эталон границ: [`features/servers/README.md`](../../site/src/features/servers/README.md) (`client` / `server` / `model` + server-only ports, без прямого импорта внутренностей снаружи).

### Hotspots `lib/` root (по префиксу имени)

Корень `lib/` очищен (`root_files` = 0, `root_prefix_hotspots` = []). Prefix-hotspots больше не применимы: helpers живут в `lib/http/`, `lib/platform/`, feature ports и `lib/services/<domain>/`.

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

**Slice 29 done:** `components/admin/*` → [`features/moderation/admin-home.ts`](../../site/src/features/moderation/admin-home.ts) (`Admin*Section` for `/admin` overview: health, reports, verification, builds quarantine, ad inventory); `app/admin/status-labels` → [`admin-status-labels.ts`](../../site/src/features/moderation/admin-status-labels.ts) (moved from `lib/` in slice 37); владение **Moderation** (staff dashboard composition + cross-feature ports `community/report-evidence-links`, `resources/qa-report-actions`, `resources/quarantine-controls`); depcruise `moderation-feature-*` + `moderation-feature-boundaries.node-test.mjs`; `components/` −5 production files (`admin/` cleared).

**Slice 30 done:** `storage-maintenance-controls` → [`features/moderation/storage-maintenance.ts`](../../site/src/features/moderation/storage-maintenance.ts) (`StorageDiscoveryControls`, `StorageCleanupControls`); владение **Moderation** (staff storage discovery/cleanup на `/admin/storage`, API и services без изменений); depcruise public API + `moderation-client-isolation` для порта `storage-maintenance`; потребители — `app/admin/storage/page.tsx`, `app/admin/storage/objects/[id]/page.tsx`; корень `components/` −1 production file.

**Slice 31 done:** `license-*` cluster в `components/` root → [`features/commerce`](../../site/src/features/commerce/README.md): client port [`license-controls.ts`](../../site/src/features/commerce/license-controls.ts) (`LicenseControlPanel`, `LicenseRuntimeProbe`), server ports [`license-detail.ts`](../../site/src/features/commerce/license-detail.ts), [`license-archive.ts`](../../site/src/features/commerce/license-archive.ts), [`license-history-server.ts`](../../site/src/features/commerce/license-history-server.ts); владение **Commerce** (workspace/admin license detail, archive filters, owner/staff control panel, runtime probe); server composition в `features/commerce/server/` вне client-isolation; depcruise `commerce-feature-*` + `commerce-feature-boundaries.node-test.mjs`; корень `components/` −5 production files.

**Slice 32 done:** `subscription-*` cluster в `components/` root → [`features/commerce`](../../site/src/features/commerce/README.md): client port [`subscription-controls.ts`](../../site/src/features/commerce/subscription-controls.ts) (`SubscriptionControls`, `SubscriptionFeeEstimator`, `SubscriptionRecovery`), shared nav port [`subscription-workspace.ts`](../../site/src/features/commerce/subscription-workspace.ts) (`subscriptionNavLinkClass`, RSC-safe); владение **Commerce** (workspace subscription activate/cancel, fee estimate, intent recovery); `PlanReviewTerms` остаётся в `components/` до plan-review absorb; depcruise `commerce-feature-*` + boundary tests; корень `components/` −4 production files.

**Slice 33 done:** `order-*` cluster в `components/` root → [`features/commerce`](../../site/src/features/commerce/README.md): client ports [`order-cancellation.ts`](../../site/src/features/commerce/order-cancellation.ts) (`OrderCancellationForm`), [`order-case-forms.ts`](../../site/src/features/commerce/order-case-forms.ts) (`OrderCaseReviewForm`; create form internal), server composition [`order-case-server.ts`](../../site/src/features/commerce/order-case-server.ts) (list/detail/create pages + `orderCaseMetadata`), RSC port [`order-terms.ts`](../../site/src/features/commerce/order-terms.ts) (`OrderTermsReportView`); владение **Commerce** (purchase cancel, order cases, terms report); `action-confirm-checkbox` / `confirm-action` остаются в `components/`; depcruise `commerce-feature-*` + boundary tests; корень `components/` −4 production files.

**Slice 34 done:** commerce leftovers в `components/` root → [`features/commerce`](../../site/src/features/commerce/README.md): client ports [`commercial-plans.ts`](../../site/src/features/commerce/commercial-plans.ts) (`CommercialPlanForm`, `CommercialFeeCalculator`), [`plan-reviews.ts`](../../site/src/features/commerce/plan-reviews.ts) (`PlanReviewForm`), RSC port [`plan-reviews-workspace.ts`](../../site/src/features/commerce/plan-reviews-workspace.ts) (`PlanReviewTerms`, `planReviewNavLinkClass`), [`plan-review-detail.ts`](../../site/src/features/commerce/plan-review-detail.ts) (`PlanReviewDetailView`), [`seller-sales.ts`](../../site/src/features/commerce/seller-sales.ts) (`SellerSalesReportView`); владение **Commerce** (admin commercial plans, public fee calculator, plan review workspace, seller report); `confirm-action` / `action-confirm-checkbox` остаются в `components/`; depcruise `commerce-feature-*` + boundary tests; корень `components/` −7 production files.

**Slice 35 done:** `developer-experience` → [`features/accounts/developer-experience.ts`](../../site/src/features/accounts/developer-experience.ts) (`DeveloperExperience`); владение **Accounts** (публичная карточка verified developer на user/developer profile pages, рядом с `DeveloperProfileEditor`); RSC port в `clientUtilPorts` (без `"use client"`); depcruise `accounts-feature-*` + boundary tests; потребители — `app/users/[username]/page.tsx`, `app/developers/[username]/page.tsx`; корень `components/` −1 production file.

**Slice 36 done:** `confirm-action` + `action-confirm-checkbox` → [`features/shell`](../../site/src/features/shell/README.md): client ports [`confirm-action.ts`](../../site/src/features/shell/confirm-action.ts) (`confirmAction`), [`action-confirm-checkbox.ts`](../../site/src/features/shell/action-confirm-checkbox.ts) (`ActionConfirmCheckbox`, `actionConfirmCheckboxFocusClass`); владение **Shell** (shared destructive confirm UX); depcruise public API + cross-feature client isolation (как `modal-dialog`, plus commerce shell allowlist); порты с `"use client"`; потребители — accounts/commerce/community/library/moderation/notifications/organizations/resources/servers/support; корень `components/` опустеет (0 production files).

**Slice 37 done:** first `lib/` root absorb → [`features/moderation`](../../site/src/features/moderation/README.md): util ports [`admin-status-labels.ts`](../../site/src/features/moderation/admin-status-labels.ts) (`adminStatusLabel`, `adminStatusTone`), [`verification-moderation.ts`](../../site/src/features/moderation/verification-moderation.ts) (`buildVerificationDecisionPayload`, `normalizeVerificationReviewNotes`); владение **Moderation**; depcruise public API + `clientUtilPorts`; корень `lib/` −2 files.

**Slice 38 done:** `theme-preference` → [`features/shell/theme-preference.ts`](../../site/src/features/shell/theme-preference.ts) (`parseThemePreference`, `resolveThemePreference`, `nextThemePreference`, `colorSchemeForTheme`, `SYSTEM_THEME_QUERY`); владение **Shell**; depcruise public API + `clientUtilPorts`; корень `lib/` −1 file.

**Slice 39 done:** `home-personal-preference` → [`features/shell/home-personal-preference.ts`](../../site/src/features/shell/home-personal-preference.ts) (`parseHomePersonalPreference`, `HOME_PERSONAL_COOKIE`, …); владение **Shell**; types уже в [`home-personal-changes-types.ts`](../../site/src/features/shell/home-personal-changes-types.ts); server loader перенесён в Slice 42; depcruise public API + `clientUtilPorts`; корень `lib/` −1 file.

**Slice 40 done:** `ad-preference` → [`features/accounts/ad-preference.ts`](../../site/src/features/accounts/ad-preference.ts) (`parseAdPreference`, `AD_OPT_OUT_COOKIE`, …); владение **Accounts** (settings advertising opt-out); depcruise public API + `clientUtilPorts`; корень `lib/` −1 file.

**Slice 41 done:** `notification-inbox-events` + `visible-polling` → [`features/notifications`](../../site/src/features/notifications/README.md): util ports [`notification-inbox-events.ts`](../../site/src/features/notifications/notification-inbox-events.ts), [`visible-polling.ts`](../../site/src/features/notifications/visible-polling.ts); владение **Notifications**; depcruise public API + client isolation; корень `lib/` −2 files (+ colocated unit test move).

**Slice 42 done:** `home-personal-changes` server loader → [`features/shell/home-personal-changes-server.ts`](../../site/src/features/shell/home-personal-changes-server.ts) (`loadPersonalChangesSummary`); реализация в [`features/shell/server/home-personal-changes.ts`](../../site/src/features/shell/server/home-personal-changes.ts); владение **Shell**; потребители — `app/page.tsx` + home-personal / feed tests; depcruise public API + shell `servers` boundary; `lib/platform/home-personal-changes.ts` удалён.

**Slice 43 done:** `parseProfilePage` → [`features/accounts/profile-pagination.ts`](../../site/src/features/accounts/profile-pagination.ts) (рядом с `ProfileResourcePagination`); владение **Accounts**; потребители — user/developer pages + org public profile; `lib/platform/profile-pagination.ts` удалён.

Cross-feature shell/chrome leftovers в `components/` root: **cleared** (после slice 36 — `confirm-action` / `action-confirm-checkbox`).

**Slice 5 done:** shell+home hard-coded string inventory — [`planning/shell-home-hardcoded-strings.json`](../../planning/shell-home-hardcoded-strings.json).  
Регенерация: `python3 planning/tools/inventory_shell_home_i18n.py --output planning/shell-home-hardcoded-strings.json`  
Проверка: `python3 planning/tools/inventory_shell_home_i18n.py --check planning/shell-home-hardcoded-strings.json`  
Scope: `features/shell` (без тестов, без `server/` и `*-server` портов), `app/page.tsx`, home panels, `app/layout.tsx` metadata, `@nexus/ui` BrandMark. Brand / unknown-marker literals живут в allowlist; `locale === "ru"|"en" ? "copy" : "copy"` в scope должен оставаться **0**. Новые не-allowlisted литералы валят plan CI.

**Slice 6 done:** sidebar chrome uses shared `@nexus/ui` `BrandMark` (collapsed tile-only, expanded wordmark + locale `openFreeBeta` tag); duplicate `brand.sidebar.*` literals removed from shell inventory allowlist.  
**Slice 7 done:** footer credit line moved to `dictionary.footer.creditLine` (en/ru); inventory allowlist no longer tracks footer copyright glue.

**Slice 44 done:** public-guest hard-coded string inventory (A/B) — [`planning/public-guest-hardcoded-strings.json`](../../planning/public-guest-hardcoded-strings.json).  
Регенерация: `python3 planning/tools/inventory_public_guest_i18n.py --output planning/public-guest-hardcoded-strings.json`  
Проверка: `python3 planning/tools/inventory_public_guest_i18n.py --check planning/public-guest-hardcoded-strings.json`  
Scope: `app/discover`, `app/servers` (публичный каталог/карточка), `app/articles`, `features/discovery` (без `server/` и `*-server`), guest directory components (`mta-master-server-directory`, `server-card`, `server-connect-controls`, `server-follow-button`). Sibling к Slice 5 — shell+home контракт не расширяли. Unknown-marker `—` в allowlist; `serverDetail.discord` уведён в RU+EN dictionaries.

**Slice 45 done:** public-guest inventory coverage expansion (A/B) — same snapshot + tool. Added app roots `market`, `community`, `organizations`, `users`, `developers`, `support`, `explore`, `acquire`; selective guest feature components (market/resource listing & detail chrome, community feed/discussion/article card, public profile pagination/experience, support entry — not staff report/moderation or org workspace forms). Scanner skips TS `=>` false-positives; version prefix `v`, `SHA-256`, and unknown-marker `—` allowlisted. `unallowlisted: 0`; no new locale copy ternaries; no dictionary moves required (surfaces already on RU/EN keys).

**Slice 46 done:** shared RSC honest loading chrome → [`features/shell/honest-loading.ts`](../../site/src/features/shell/honest-loading.ts) (`HonestLoadingShell`); владение **Shell**; depcruise public API + `clientUtilPorts` (no `"use client"`); ~82 near-identical `app/**/loading.tsx` migrated (workspace commerce history, auth, public directory/profile, legal/settings clusters) preserving heading ids / titles / skeleton markup; `PublicationFeedLoading` optionally composes the shell.

**Slice 47 done:** residual honest loading absorb — ~101 remaining manual `aria-busy` `app/**/loading.tsx` (admin moderation/support/storage, workspace content/library/orgs/servers, global `app/loading.tsx`) migrated onto `HonestLoadingShell`; optional `description` slot for registration chrome (`workspace/servers/new`); re-export / feed / specialized feature loaders left as thin wrappers.

**Slice services-domain done:** all 86 `lib/services` root modules grouped into feature-aligned `lib/services/<domain>/` (accounts, commerce, community, discovery, library, moderation, notifications, organizations, resources, servers, support, trust); ARCHITECTURE service layer path unchanged; import/mocks/`package.json` test globs rewritten; `services_root_files` → 0.

**Slice lib-http-platform done:** remaining `lib/` root kernels moved into `lib/http/` (browser/bounded/private/public adapters) and `lib/platform/` (i18n barrel/server, observability, postgres-error, offline-cache; `home-personal-changes` → Shell Slice 42; `profile-pagination` → Accounts Slice 43); `support-response.test.ts` → `site/tests/unit/`; depcruise + boundary `safeLib` allow `platform/i18n` and `http/private-api-request`; `lib_root_files` → 0; `lib/` root dirs = `http`, `i18n`, `platform`, `services`.

## TO-BE (цель читаемости)

Корни `components/`, `lib/` и `lib/services/` уже опустели на AS-IS (`1dc641a9`). Дальше — не «ещё один переезд корня», а углубление читаемости внутри features / services domains и честность shell/i18n/journey.

```text
site/src/
├── app/                      # только routing, metadata, thin HTTP adapters
├── features/
│   ├── shell/                # navbar, footer, locale, guest/member nav
│   ├── accounts/ discovery/ servers/ resources/ …
│   └── trust/                # при необходимости отдельно от moderation
├── lib/
│   ├── services/<domain>/    # оркестрация по доменам (корень services пуст)
│   ├── http/                 # browser / bounded / private / public adapters
│   ├── i18n/                 # locale primitive
│   └── platform/             # shared non-UI kernels
└── (components/ → держать пустым; новый UI только в feature или @nexus/ui)

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

| #   | Slice                                                                                                             | Ось                              | Статус   |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------- |
| 1   | Topology scoreboard (этот документ + inventory)                                                                   | скорость разработки / понятность | **done** |
| 2   | Husk & import honesty (`/packages/`, `/apps/` gitignore)                                                          | babysitting tax                  | **done** |
| 3   | Design direction + `@nexus/ui` tokens/primitives                                                                  | shell 2027                       | **done** |
| 4   | Structural absorb #1 — shell nav/footer → `features/shell`                                                        | читаемость + путь гостя          | **done** |
| 5   | i18n inventory automation (shell+home hard-coded strings)                                                         | честность RU/EN                  | **done** |
| 6   | Sidebar BrandMark absorb (drop duplicate brand literals)                                                          | brand honesty + guest path       | **done** |
| 7   | Footer credit line → `footer.creditLine` i18n                                                                     | честность RU/EN                  | **done** |
| 44  | i18n inventory automation (public-guest discover/servers/articles)                                                | честность RU/EN                  | **done** |
| 45  | i18n inventory coverage (public-guest market/community/orgs/users/support/…)                                      | честность RU/EN                  | **done** |
| T   | services-domain — `lib/services/<domain>/`                                                                        | читаемость service layer         | **done** |
| T   | lib-http-platform — `lib/http/` + `lib/platform/`                                                                 | очистка `lib/` root              | **done** |
| T   | Slice 42 — Shell `home-personal-changes` server port                                                              | читаемость + Shell ownership     | **done** |
| T   | Slice 43 — Accounts `parseProfilePage` into `profile-pagination` port                                             | читаемость + Accounts ownership  | **done** |
| D/E | Scoreboard sync после http/platform + services domains                                                            | docs honesty                     | **done** |
| C   | Journey honesty — load/session/empty/recovery program complete; write/form ErrorStates intentionally out of scope | честность user journey           | **done** |
| D/E | Scoreboard sync после residual honesty + Slice 42/43                                                              | docs honesty                     | **done** |
| D/E | Scoreboard sync после Slice 44/45 public-guest i18n + journey C close                                             | docs honesty                     | **done** |
| T   | Slice 46 — Shell `HonestLoadingShell` + large `loading.tsx` absorb                                                | читаемость + loading honesty     | **done** |
| T   | Slice 47 — residual admin/workspace/global `loading.tsx` → `HonestLoadingShell`                                   | читаемость + loading honesty     | **done** |
| D/E | Scoreboard sync после Slice 47                                                                                    | docs honesty                     | **done** |

Дальше чередовать T (topology) → A/B (shell/i18n) → C (journey honesty) → D/E (tests/docs); F только как локальный ops prep. Новые TOPO ID в `planning/tasks.json` не заводить.

## Связанные входы

- Архитектура и исключения depcruise: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
- Карта пакетов и features: [`docs/PROJECT-MAP.md`](../PROJECT-MAP.md)
- CI scopes: [`docs/current/quality.md`](quality.md)
- Исторический foundation-перенос: [`docs/STRUCTURE-REFACTORING.md`](../STRUCTURE-REFACTORING.md) / archive migrations
- Path inventory (legacy terms): `planning/tools/inventory_structure.py`
