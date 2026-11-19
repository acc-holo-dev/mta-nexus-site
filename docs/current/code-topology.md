# Топология кода: AS-IS scoreboard и TO-BE читаемость

**measured_at:** 18 ноября 2026 (Europe/Moscow).  
**source_sha:** `b520ec8d` (`dev`, Waves 154–158 tip).  
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
│       ├── platform/        # observability, postgres-error …
│       └── services/<domain>/  # оркестраторы по доменам (services root = 0)
└── packages/                # канонические @nexus/* (workspace)
    ├── ui/ domain/ db/ validation/ security/ storage/ config/
```

Корневые `packages/*` и `apps/web` **не** в `pnpm-workspace.yaml` и **не** в Git: локальные пустые husks после переноса (см. § Husks). Workspace: только `site` + `site/packages/*`.

## Counts (HEAD inventory)

| Область                    |             Факт на `e9e88ceb` |
| -------------------------- | -----------------------------: |
| `features/*` domains       |                             13 |
| `components/` tree files   |                              0 |
| `components/` root files   |                              0 |
| `lib/` tree files          |                            126 |
| `lib/` root files          |                              0 |
| `lib/` root dirs           | http, i18n, platform, services |
| `lib/services/` root files |                              0 |
| `lib/**/*-i18n.ts`         |                              0 |
| `app/**/route.ts`          |                            282 |
| `site/tests` files         |                           1663 |
| `@nexus/ui` src files      |                             20 |
| `@nexus/domain` src files  |                             54 |
| `@nexus/db` src files      |                            201 |

### Features

| Feature       | files |  bytes |
| ------------- | ----: | -----: |
| accounts      |    52 | 158691 |
| commerce      |    71 | 330627 |
| community     |   128 | 594001 |
| discovery     |     8 |  33815 |
| library       |    86 | 409749 |
| moderation    |    35 | 158575 |
| notifications |    25 | 136481 |
| organizations |    49 | 187199 |
| resources     |   171 | 747623 |
| servers       |    87 | 318668 |
| shell         |    67 | 111009 |
| support       |    22 | 110720 |
| trust         |    16 |  62612 |

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

**Slice 48 done:** workspace-member hard-coded string inventory (A/B) — [`planning/workspace-member-hardcoded-strings.json`](../../planning/workspace-member-hardcoded-strings.json).  
Регенерация: `python3 planning/tools/inventory_workspace_member_i18n.py --output planning/workspace-member-hardcoded-strings.json`  
Проверка: `python3 planning/tools/inventory_workspace_member_i18n.py --check planning/workspace-member-hardcoded-strings.json`  
Scope: `app/workspace`, `app/admin`, `app/settings`, `app/auth`, `app/security`; library/commerce/moderation/organizations/notifications/accounts components; selective author/report/server/resource publisher forms. Moved remaining form placeholder literals into EN/RU dictionaries (`serverRegistration` / `serverManagement` / `publishing` / `resource-management-i18n`). Unknown-marker `—` allowlisted; `unallowlisted: 0`.

**Slice 49 done:** specialized server/feature + platform-report loading chrome → `HonestLoadingShell` — `ServerStatisticsLoading`, `ServerObservationBrowserLoading`, and `/workspace/platform-reports` list/detail `loading.tsx` (was bare muted paragraph). Remaining `loading.tsx` without the shell are thin re-exports / PublicationFeed / trust wrappers.

**Slice 50 done:** client loading shells + residual version placeholders — `settings-page-client` and `support-case-thread` loading returns compose `HonestLoadingShell`; author/resource/library requirements form placeholders (`1.1.0` / `1.6.0` / `1.6.0-9.22279.0`) moved into publishing + `resource-requirements-i18n` dictionaries.

**Slice 51 done:** Shell `global-error-copy` port (`globalErrorCopy`, `detectGlobalErrorLocale`) extracted from `app/global-error.tsx` for bilingual honesty without layout/i18n provider; `/acquire` client product/session loading fallbacks compose `HonestLoadingShell`.

**Slice 52 done:** `offline-cache-policy` → [`features/shell/offline-cache-policy.ts`](../../site/src/features/shell/offline-cache-policy.ts) (Shell ownership; proxy + SW public-readonly opt-in); C residual retry ErrorStates wired to existing/new recovery descriptions — support center/thread, profile privacy, organization workspace/team directory (`uncertainHint`), Web Push (`webPushErrorHint`), `/acquire` claim (`claimErrorHint`).

**Slice 53 done:** `HonestLoadingShell` gains `headingLevel` (nested h2 panels); settings context-switcher loading chrome composes it; C residual auth/settings + invalid-filter/forbidden recovery descriptions — verify-email / reset-password, settings notice (`loadFailedHint`), downloads/deliveries/receipts/order-terms/statistics `invalidHint`, community-report + support forbidden/queryInvalid/notFound hints.

**Slice 54 done:** feature-server hard-coded string inventory (A/B) — [`planning/feature-server-hardcoded-strings.json`](../../planning/feature-server-hardcoded-strings.json).  
Регенерация: `python3 planning/tools/inventory_feature_server_i18n.py --output planning/feature-server-hardcoded-strings.json`  
Проверка: `python3 planning/tools/inventory_feature_server_i18n.py --check planning/feature-server-hardcoded-strings.json`  
Scope: all `features/*/server` RSC screens + residual interactive components outside shell-home/public-guest/workspace-member inventories. Moved discovery active-filter query label, server-history `timezoneUtc`, and build-package `sha256Label` into dictionaries; unknown-marker `—` allowlisted. `unallowlisted: 0`.

**Slice 55 done:** collapse `lib/platform/i18n` + `lib/platform/i18n-server` into [`lib/i18n`](../../site/src/lib/i18n/index.ts) + [`lib/i18n/server.ts`](../../site/src/lib/i18n/server.ts); mass import rewrite (~500+ files); depcruise `safeLib` + `resources-view-isolation` allow `i18n(?:\\.ts$|/)`; `lib/platform/` retains only observability + postgres-error.

**Wave 56 done:** write/form + residual ErrorState honesty (formerly OOS). Shared primitives: `errors.formErrorHint`, `errors.unknownMarker`, helpers [`lib/i18n/unknown.ts`](../../site/src/lib/i18n/unknown.ts). Production `ErrorState` surfaces carry recovery `description`; honesty locks and interaction harnesses updated for the new props.

**Wave 57 done:** adopt `formatUnknown` / `unknownMarker` across production surfaces; purge unknown-marker inventory allowlists (0 remaining); policy lock [`unknown-marker-honesty-policy.test.ts`](../../site/tests/unit/unknown-marker-honesty-policy.test.ts); relocate `lib/platform/observability` + `postgres-error` into folder modules.

**Wave 58 done:** service-worker offline document copy → Shell [`offline-document-copy.ts`](../../site/src/features/shell/offline-document-copy.ts) injected into [`sw.js/route.ts`](../../site/src/app/sw.js/route.ts); resource build/detail MTA and SHA-256 labels → dictionary keys (`managementCopy.mta`, `copy.mtaVersion`, `packageCopy.sha256Label`); honesty locks for both surfaces.

**Wave 59 done:** Home hero budget — drop `liveEcosystem` eyebrow; brand + title + description + CTA only. Micro honesty — plan-review empty `<option>` → `unknownMarker`; admin quarantine `SHA-256` → `storageMaintenanceCopy.hash`.

**Wave 60 done:** SW offline document uses Shell `offlineDocumentTheme` (dark tokens + nexus fonts) and bilingual `pushFallbackBody`; push handler picks locale via `navigator.language`.

**Wave 61 done:** provenance UI `SHA-256` → `provenance.hash`; UX-05 regression locks for native `color-scheme: inherit`, autofill `--nexus-text`/`--nexus-inset`, and longhand typography utilities.

**Wave 62 done:** hygiene — drop stale public-guest `market.provenance.sha256-label` allowlist; sync design-direction with exhausted Shell 2027 honesty queue. No further Wave-class TOPO/i18n slice without a new program (API envelope localization or F/ops).

**Wave 63 done:** `/api/search` passes `nexus_locale` into `discoveryService.search`; empty server descriptions use `serverDetail.serverFallback` (same composition as server detail metadata).

**Wave 64 done:** scoreboard honesty — `code-topology.md` counts/features/`source_sha` match tip inventory after Wave 63 (was still stamped Wave 56/57). Topology Wave-class exhausted again pending owner API-envelope or F/ops direction.

**Wave 65 done:** `/api/search` error envelope (query length / unknown type / rate / unavailable) uses bilingual `discoverySearchApiCopy` via `nexus_locale`; JSON shape unchanged (`error` + `unavailable`). First tip of scoped API-envelope localization.

**Wave 66 done:** `/api/servers/directory` 400/503 errors use bilingual `serversDirectoryApiCopy` via `nexus_locale`; JSON shape unchanged (`error` / `details` / `Retry-After`).

**Wave 67 done:** `/api/auth/password` errors use bilingual `authPasswordApiCopy` via `nexus_locale` (replaces ad-hoc RU ternary for ACCOUNT_CHANGED); JSON shape unchanged.

**Wave 68 done:** `/api/auth/session` GET/DELETE errors use bilingual `authSessionApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 69 done:** `/api/auth/sessions` GET/DELETE errors use bilingual `authSessionsApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 70 done:** `/api/auth/login` errors use bilingual `authLoginApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` passthrough remains English).

**Wave 71 done:** `/api/auth/password-reset` POST/PATCH errors use bilingual `authPasswordResetApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 72 done:** `/api/auth/register` errors use bilingual `authRegisterApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` passthrough remains English).

**Wave 73 done:** `/api/auth/context` GET/POST errors use bilingual `authContextApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 74 done:** `/api/auth/email-verification` GET/POST/PATCH errors use bilingual `authEmailVerificationApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` passthrough remains English).

**Wave 75 done:** `/api/reports` GET/POST errors use bilingual `reportsApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` passthrough remains English).

**Wave 76 done:** `/api/resources/claim` POST errors use bilingual `resourceClaimApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` message passthrough remains English).

**Wave 77 done:** `/api/servers/[id]/claim-challenge` (+ `/verify`) POST errors use bilingual `serverClaimApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` passthrough remains English; success `instruction` localized in Wave 81).

**Wave 78 done:** `/api/resources/inspect-meta` POST errors use bilingual `resourceInspectMetaApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError`/`MetaInspectionInputError` passthrough remains English; success `note` localized in Wave 82).

**Wave 79 done:** `/api/workspace/platform-reports` (+ `/[id]`) GET errors use bilingual `platformReportsApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 80 done:** `/api/workspace/server-organizations` GET errors use bilingual `serverOrganizationsApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 81 done:** `/api/servers/[id]/claim-challenge` success `instruction` uses bilingual `serverClaimApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` passthrough remains English).

**Wave 82 done:** `/api/resources/inspect-meta` success `note` uses bilingual `resourceInspectMetaApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError`/`MetaInspectionInputError` passthrough remains English).

**Wave 83 done:** `/api/servers` GET/POST errors use bilingual `serversApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` message passthrough remains English).

**Wave 84 done:** `/api/mta/servers` GET 503 uses bilingual `serversDirectoryApiCopy.mtaUnavailable` via `nexus_locale`; JSON shape unchanged.

**Wave 85 done:** `/api/servers/[id]/history` GET errors use bilingual `serverHistoryApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 86 done:** `/api/content/[slug]` GET errors use bilingual `contentApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 87 done:** `/api/notifications/mark-read` POST errors use bilingual `notificationMarkReadApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` body passthrough remains English).

**Wave 88 done:** `/api/notifications/preferences` GET/PATCH errors use bilingual `notificationPreferencesApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` body passthrough remains English).

**Wave 89 done:** `/api/checkout` POST disabled envelope uses bilingual `checkoutApiCopy` via `nexus_locale`; JSON shape unchanged (`code: CHECKOUT_DISABLED`).

**Wave 90 done:** `/api/servers/[id]` PATCH errors extend bilingual `serversApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` message passthrough remains English).

**Wave 91 done:** `/api/notifications/push` GET/POST/DELETE errors use bilingual `notificationPushApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` body passthrough remains English).

**Wave 92 done:** `/api/verification` GET/POST errors use bilingual `verificationApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` body passthrough remains English).

**Wave 93 done:** `/api/products` GET/POST errors use bilingual `productsApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` body passthrough remains English).

**Wave 94 done:** `/api/products/[id]` GET errors extend bilingual `productsApiCopy` via `nexus_locale`; PATCH remains code-only.

**Wave 95 done:** `/api/products/[id]/download` GET errors use bilingual `productDownloadApiCopy` via `nexus_locale`; JSON shape unchanged (`AppError` body passthrough remains English).

**Wave 96 done:** `/api/notifications` GET 500 uses bilingual `notificationsApiCopy` via `nexus_locale`; JSON shape unchanged.

**Wave 97 done:** `/api/products/[id]/builds` POST route-authored errors use bilingual `productBuildsApiCopy` via `nexus_locale`; `AppError` body passthrough remains English; codes/`Retry-After` unchanged.

**Wave 98 done (large):** remaining major EN API envelopes — `/api/content` GET+POST extends `contentApiCopy`; `/api/admin/builds/[buildId]/download` via `adminBuildDownloadApiCopy`; `/api/admin/actions` via `adminActionsApiCopy`; AppError message passthrough stays English where previously passthrough.

**Wave 99 done (large):** workspace `library` / `resources` / `subscriptions` document titles move from static EN `metadata` to `generateMetadata` + existing locale copy/`getDictionary` (37 pages); AppError passthrough unchanged.

**Wave 100 done (large):** workspace commerce (`purchases`/`acquisitions`/`licenses`/`cart`/`finance`/`sales`) + admin (`commerce`/`licenses`/`resources`) document titles via `generateMetadata` (24 pages); AppError passthrough unchanged.

**Wave 101 done (large):** residual document titles — workspace hub/server detail, public subscriptions/market/servers/versions, auth+settings layouts, admin hub/storage/requirements, security; format fix for Wave 99 test imports; AppError passthrough unchanged.

**Wave 102 done:** `/api/support` always remaps `error` via `supportPrivateJson` + `supportWorkspaceError` for both locales; `ACTOR_*` codes mapped; route-authored English placeholders cleared; AppError message passthrough elsewhere unchanged.

**Wave 103 done:** inbox `formatNotification` localizes staff `New verification request` awaiting-review notices and `New server update` titles (stored body kept); DB notice contracts stay English.

**Wave 104 done:** inbox `formatNotification` localizes `Password reset completed` security notices; DB notice contract stays English.

**Wave 105 done:** account mail dispatcher subjects/bodies use bilingual slash copy (no recipient locale column yet); challenge URL/token placement unchanged.

**Wave 107 done:** CI SMTP test receiver advertises `SMTPUTF8` + `8BITMIME` so bilingual account-mail subjects/bodies are accepted (Wave 105 otherwise discarded on ASCII-only EHLO).

**Wave 108 done:** `formatNotification` canonicalizes bilingual `EN / RU` notice titles; password-reset producer stores slash title for Web Push while inbox remapping stays locale-aware.

**Wave 109 done:** Shared `noticeStoredTitles` (`EN / RU`) in `@nexus/domain` wired through notification producers (follow, discussion, verification, support, reports, builds, Q&A, org access, reactions, publication).

**Wave 110 done:** Stamped guest/member/feature-server/shell-home i18n inventories to tip; extended `noticeStoredTitles` with `newArticleComment` for legacy comment remapping.

**Wave 111 done:** `noticeStoredMessages` bilingual slash bodies for static Web Push producers; `formatNotification` matches on English message segment.

**Waves 112–123 done:** Expanded templated Web Push bodies (follower, moderation, support/org/publication activity, report status, verification, builds, Q&A); regex matchers use English slash segment; auth + notification AppError envelopes localize via `authAppErrorText` / locale copy.

**Waves 124–133 done:** CI follow-ups for bilingual stored notice assertions + `auth-app-error` public API; shared `localeAppErrorText`; AppError envelopes localized for reports, verification, products (+download/+builds), content collection, servers register/PATCH, claim-challenge, resource claim, admin actions, inspect-meta (including `MetaInspectionInputError`).

**Waves 134–140 done:** Settings signed-out detection accepts RU/EN `authenticationRequired` (not wrong-password 401); `SettingsRequestError` optionally carries `code`; `noticeStoredTitles` folds resource-release + license-term titles; community staff create-notice uses `newCommunityReport` when `job.community`; defense remappers for release/license slash titles without `data`; `newArticleComment` locked as remapping-only residual. Route.ts AppError English `error.message` passthrough queue treated exhausted.

**Waves 141–153 done:** Dynamic Web Push bodies for license-term UTC, resource-release `title · version`, and server publication `server: title`; remapper fallbacks; CI fix for community report delivery fixture; bilingual browser CSRF envelopes; ACTOR_* client remappers (follow/platform/inbox/commerce); QA/build/security title-only remappers.

**Waves 154–158 done:** ACTOR_* client remappers across resource/plan/review/library, accounts privacy/history, platform-report, server-statistics; honesty lock.

**Slice services-domain done:** all 86 `lib/services` root modules grouped into feature-aligned `lib/services/<domain>/` (accounts, commerce, community, discovery, library, moderation, notifications, organizations, resources, servers, support, trust); ARCHITECTURE service layer path unchanged; import/mocks/`package.json` test globs rewritten; `services_root_files` → 0.

**Slice lib-http-platform done:** remaining `lib/` root kernels moved into `lib/http/` (browser/bounded/private/public adapters) and `lib/platform/` (observability, postgres-error; i18n barrels → `lib/i18n` Slice 55; `offline-cache` → Shell Slice 52; `home-personal-changes` → Shell Slice 42; `profile-pagination` → Accounts Slice 43); `support-response.test.ts` → `site/tests/unit/`; depcruise + boundary `safeLib` allow `i18n` and `http/private-api-request`; `lib_root_files` → 0; `lib/` root dirs = `http`, `i18n`, `platform`, `services`.

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
| A/B | Slice 48 — workspace-member i18n inventory + form placeholder dictionary move                                     | честность RU/EN                  | **done** |
| D/E | Scoreboard sync после Slice 48                                                                                    | docs honesty                     | **done** |
| T   | Slice 49 — server statistics/observations + platform-reports loaders → `HonestLoadingShell`                       | читаемость + loading honesty     | **done** |
| D/E | Scoreboard sync после Slice 49                                                                                    | docs honesty                     | **done** |
| T/A | Slice 50 — settings/support client loaders + residual version placeholders                                        | loading honesty + RU/EN          | **done** |
| D/E | Scoreboard sync после Slice 50                                                                                    | docs honesty                     | **done** |
| T/A | Slice 51 — Shell `global-error-copy` + acquire HonestLoadingShell fallbacks                                       | читаемость + RU/EN + loading     | **done** |
| D/E | Scoreboard sync после Slice 51                                                                                    | docs honesty                     | **done** |
| T/C | Slice 52 — Shell `offline-cache-policy` absorb + residual retry ErrorState descriptions                           | читаемость + journey honesty     | **done** |
| D/E | Scoreboard sync после Slice 52                                                                                    | docs honesty                     | **done** |
| T/C | Slice 53 — HonestLoadingShell `headingLevel` + auth/settings/invalid-filter recovery descriptions                 | читаемость + journey honesty     | **done** |
| D/E | Scoreboard sync после Slice 53                                                                                    | docs honesty                     | **done** |
| A/B | Slice 54 — feature-server (+ residual component) i18n inventory                                                   | честность RU/EN                  | **done** |
| D/E | Scoreboard sync после Slice 54                                                                                    | docs honesty                     | **done** |
| T   | Slice 55 — collapse `lib/platform/i18n*` into `lib/i18n`                                                          | читаемость lib ownership         | **done** |
| D/E | Scoreboard sync после Slice 55                                                                                    | docs honesty                     | **done** |
| C   | Wave 56 — write/form + residual ErrorState honesty (~50 commits, one CI tip)                                      | journey honesty (бывший OOS)     | **done** |
| A/C | Wave 57 — formatUnknown adoption + unknown-marker allowlist purge + policy                                        | честность RU/EN + unknown        | **done** |
| T   | Wave 57 — `lib/platform/{observability,postgres-error}/` folder modules                                           | читаемость lib ownership         | **done** |
| D/E | Scoreboard sync после Wave 56/57 (single squash tip)                                                              | docs honesty                     | **done** |
| A/C | Wave 58 — SW offline document i18n + resource MTA/SHA-256 labels                                                  | честность RU/EN + PWA honesty    | **done** |
| D/E | Scoreboard sync после Wave 58                                                                                     | docs honesty                     | **done** |
| A/C | Wave 59 — Home hero budget + plan-review/quarantine micro honesty                                                 | Shell 2027 + RU/EN honesty       | **done** |
| D/E | Scoreboard sync после Wave 59                                                                                     | docs honesty                     | **done** |
| A/C | Wave 60 — SW offline theme tokens + bilingual push fallback                                                       | PWA honesty + Shell 2027         | **done** |
| D/E | Scoreboard sync после Wave 60                                                                                     | docs honesty                     | **done** |
| A/C | Wave 61 — provenance.hash + UX-05 theme/typography verification locks                                             | RU/EN honesty + UX-05            | **done** |
| D/E | Scoreboard sync после Wave 61                                                                                     | docs honesty                     | **done** |
| D/E | Wave 62 — stale public-guest allowlist purge + design-direction sync                                              | docs / inventory honesty         | **done** |
| A   | Wave 63 — discovery search serverFallback via nexus_locale                                                        | API RU/EN honesty                | **done** |
| D/E | Wave 64 — scoreboard sync (`code-topology.md` ↔ tip inventory)                                                    | docs honesty                     | **done** |
| A   | Wave 65 — `/api/search` error envelope via discoverySearchApiCopy                                                 | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 65                                                                                     | docs honesty                     | **done** |
| A   | Wave 66 — `/api/servers/directory` errors via serversDirectoryApiCopy                                             | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 66                                                                                     | docs honesty                     | **done** |
| A   | Wave 67 — `/api/auth/password` errors via authPasswordApiCopy                                                     | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 67                                                                                     | docs honesty                     | **done** |
| A   | Wave 68 — `/api/auth/session` errors via authSessionApiCopy                                                       | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 68                                                                                     | docs honesty                     | **done** |
| A   | Wave 69 — `/api/auth/sessions` errors via authSessionsApiCopy                                                     | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 69                                                                                     | docs honesty                     | **done** |
| A   | Wave 70 — `/api/auth/login` errors via authLoginApiCopy                                                           | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 70                                                                                     | docs honesty                     | **done** |
| A   | Wave 71 — `/api/auth/password-reset` errors via authPasswordResetApiCopy                                          | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 71                                                                                     | docs honesty                     | **done** |
| A   | Wave 72 — `/api/auth/register` errors via authRegisterApiCopy                                                     | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 72                                                                                     | docs honesty                     | **done** |
| A   | Wave 73 — `/api/auth/context` errors via authContextApiCopy                                                       | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 73                                                                                     | docs honesty                     | **done** |
| A   | Wave 74 — `/api/auth/email-verification` errors via authEmailVerificationApiCopy                                  | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 74                                                                                     | docs honesty                     | **done** |
| A   | Wave 75 — `/api/reports` errors via reportsApiCopy                                                                | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 75                                                                                     | docs honesty                     | **done** |
| A   | Wave 76 — `/api/resources/claim` errors via resourceClaimApiCopy                                                  | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 76                                                                                     | docs honesty                     | **done** |
| A   | Wave 77 — servers claim-challenge (+ verify) errors via serverClaimApiCopy                                        | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 77                                                                                     | docs honesty                     | **done** |
| A   | Wave 78 — `/api/resources/inspect-meta` errors via resourceInspectMetaApiCopy                                     | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 78                                                                                     | docs honesty                     | **done** |
| A   | Wave 79 — workspace platform-reports (+ detail) errors via platformReportsApiCopy                                 | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 79                                                                                     | docs honesty                     | **done** |
| A   | Wave 80 — workspace server-organizations errors via serverOrganizationsApiCopy                                    | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 80                                                                                     | docs honesty                     | **done** |
| A   | Wave 81 — claim-challenge success instruction via serverClaimApiCopy                                              | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 81                                                                                     | docs honesty                     | **done** |
| A   | Wave 82 — inspect-meta success note via resourceInspectMetaApiCopy                                                | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 82                                                                                     | docs honesty                     | **done** |
| A   | Wave 83 — `/api/servers` collection errors via serversApiCopy                                                     | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 83                                                                                     | docs honesty                     | **done** |
| A   | Wave 84 — `/api/mta/servers` 503 via serversDirectoryApiCopy.mtaUnavailable                                       | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 84                                                                                     | docs honesty                     | **done** |
| A   | Wave 85 — servers history errors via serverHistoryApiCopy                                                         | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 85                                                                                     | docs honesty                     | **done** |
| A   | Wave 86 — `/api/content/[slug]` errors via contentApiCopy                                                         | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 86                                                                                     | docs honesty                     | **done** |
| A   | Wave 87 — notifications mark-read errors via notificationMarkReadApiCopy                                          | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 87                                                                                     | docs honesty                     | **done** |
| A   | Wave 88 — notifications preferences errors via notificationPreferencesApiCopy                                     | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 88                                                                                     | docs honesty                     | **done** |
| A   | Wave 89 — checkout disabled envelope via checkoutApiCopy                                                          | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 89                                                                                     | docs honesty                     | **done** |
| A   | Wave 90 — servers/[id] PATCH errors via serversApiCopy                                                            | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 90                                                                                     | docs honesty                     | **done** |
| A   | Wave 91 — notifications push errors via notificationPushApiCopy                                                   | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 91                                                                                     | docs honesty                     | **done** |
| A   | Wave 92 — verification collection errors via verificationApiCopy                                                  | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 92                                                                                     | docs honesty                     | **done** |
| A   | Wave 93 — products collection errors via productsApiCopy                                                          | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 93                                                                                     | docs honesty                     | **done** |
| A   | Wave 94 — products/[id] GET errors via productsApiCopy                                                            | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 94                                                                                     | docs honesty                     | **done** |
| A   | Wave 95 — product download errors via productDownloadApiCopy                                                      | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 95                                                                                     | docs honesty                     | **done** |
| A   | Wave 96 — notifications list 500 via notificationsApiCopy                                                         | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Wave 96                                                                                     | docs honesty                     | **done** |
| A   | Wave 97 — product builds upload errors via productBuildsApiCopy                                                   | API envelope RU/EN               | **done** |
| A   | Wave 98 — content collection + admin download + admin actions (large remaining EN clusters)                       | API envelope RU/EN               | **done** |
| D/E | Scoreboard sync после Waves 97–98                                                                                 | docs honesty                     | **done** |
| A   | Wave 99 — workspace library/resources/subscriptions bilingual document titles                                     | document metadata RU/EN          | **done** |
| A   | Wave 100 — workspace commerce + admin commerce/licenses/resources bilingual document titles                       | document metadata RU/EN          | **done** |
| A   | Wave 101 — residual hubs/auth/admin/public document titles + Wave 99 format fix                                   | document metadata RU/EN          | **done** |
| A   | Wave 102 — `/api/support` always-localize envelopes + ACTOR_* mapping                                             | API envelope RU/EN               | **done** |
| A   | Wave 103 — inbox formatNotification server-update + verification awaiting-review gaps                             | notification display RU/EN       | **done** |
| A   | Wave 104 — inbox formatNotification password-reset completed security notice                                      | notification display RU/EN       | **done** |
| A   | Wave 105 — account mail dispatcher bilingual slash subjects/bodies                                                | account mail RU/EN               | **done** |
| A   | Wave 106 — order more DB session snapshot selects                                                                 | CI stability                     | **done** |
| A   | Wave 107 — SMTP test receiver SMTPUTF8/8BITMIME for bilingual mail                                                | account mail CI                  | **done** |
| A   | Wave 108 — canonical bilingual notice titles + password-reset Web Push slash title                                | notification display/push RU/EN  | **done** |
| A   | Wave 109 — `noticeStoredTitles` slash pack across Web Push producers                                              | notification storage/push RU/EN  | **done** |
| D/E | Wave 110 — i18n inventory SHA stamp + `newArticleComment` stored title                                            | docs honesty / notice catalog    | **done** |
| A   | Wave 111 — `noticeStoredMessages` slash pack for static Web Push bodies                                           | notification storage/push RU/EN  | **done** |
| A   | Waves 112–119 — templated bilingual Web Push bodies + canonical message matchers                                  | notification storage/push RU/EN  | **done** |
| A   | Waves 120–123 — auth + notification AppError envelope localization                                                | API envelope RU/EN               | **done** |
| A   | Waves 124–133 — `localeAppErrorText` + product/moderation/server AppError envelopes                               | API envelope RU/EN               | **done** |
| A   | Waves 134–140 — settings signed-out locale match + notice catalog/producer gaps                                   | settings/notices RU/EN           | **done** |
| A   | Waves 141–153 — dynamic notice bodies, browser CSRF, ACTOR_* remappers, CI community-report fixture               | API/notice/client RU/EN          | **done** |
| A   | Waves 154–157 — ACTOR_* remappers across resource/library/accounts/moderation/servers                             | client remapper RU/EN            | **done** |

Дальше: Optional additive `error` on code-only commerce/product envelopes (owner-gated); F/ops external. Новые TOPO ID не заводить.

## Связанные входы

- Архитектура и исключения depcruise: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
- Карта пакетов и features: [`docs/PROJECT-MAP.md`](../PROJECT-MAP.md)
- CI scopes: [`docs/current/quality.md`](quality.md)
- Исторический foundation-перенос: [`docs/STRUCTURE-REFACTORING.md`](../STRUCTURE-REFACTORING.md) / archive migrations
- Path inventory (legacy terms): `planning/tools/inventory_structure.py`
