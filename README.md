# MTA NEXUS

MTA NEXUS is a player-first Multi Theft Auto: San Andreas platform for live server discovery, community updates, and safe free-resource distribution.

**Current repository version:** `1.2.0-beta.3`  
**Active development branch:** `main` only.

Русский интерфейс и English interface use the same application. Change the language with the language button in the top navigation; the preference is stored in the `nexus_locale` cookie. The global shell, home, resource catalog/cards, workspace, server directory, authentication, errors and metadata now use the shared dictionary.

## Local development / Локальная разработка

Authors manage articles, news and discussions at `/workspace/content`: creation,
version-checked edits, status/search/type filters and archival. Editorial edits
return to moderator review; archived entries remain read-only. `/articles` and
`/community` support URL-preserving search, type filters and bounded pagination.
Public name, biography and avatar are editable in `/settings` in both RU/EN.

Detailed MTA observations are available at `/servers/[slug]/statistics` and,
for current managers, `/workspace/servers/[id]/statistics`. Compare adjacent
24-hour, seven-day or thirty-day periods, browse 25 observations per page, and
download complete interval CSV or the displayed observation page. Empty intervals
remain unknown; observations do not measure uptime. These RU/EN views reuse the
existing collector and observation model and require no new migration.

Developers edit specialties, portfolio and Discord in `/settings/developer`.
Public profiles show these contacts and the separate verified-experience flag.
Changing specialties or portfolio removes that flag. `/workspace/verification`
supports private evidence submissions, current status and paginated feedback for
identity, developer experience and managed organizations. MTA ownership keeps its
control-challenge flow. Moderators review current profile/authority context at
`/admin`; profile revisions, live roles and independent approval are checked in
the same transaction as the decision, audit and requester notification. Both
languages include errors, metadata, saved-state recovery and navigation.

Recommended zero-host-dependency path: Docker Compose. Host Node.js, pnpm and PostgreSQL are not required.

```bash
git clone https://github.com/acc-holo-dev/mta-nexus-site.git
cd mta-nexus-site
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

Open `http://localhost:3000`.

Inside the Compose network, browser checks may use `http://nexus-local-app-1:3000`.
This hostname is explicitly allowed by Next.js development origin checks. The
published host port stays bound to loopback; use `localhost` from the host.
Changes to `apps/web/next.config.mjs` require rebuilding the app image.

If Node.js 26+ and the pinned pnpm are installed, `pnpm dev` now starts the same full Docker development stack after running the repository doctor. The repository pins the verified host Node release in both `.nvmrc` and `.node-version` (26.10.0), while `package.json#packageManager` pins pnpm 12.4.2. Version managers should use those files instead of a machine-global Node installation:

```bash
pnpm dev
```

Web Push is optional in DEV. Leave the three `WEB_PUSH_VAPID_*` values unset for a healthy-idle worker, or set the public/private/subject triplet together to exercise real durable push dispatch. Never commit the private key.

For local recovery-email testing, enable the optional Mailpit capture stack:

```bash
pnpm dev:mail
pnpm dev:mail:check
```

Docker-only equivalent: add `-f compose.mailpit.yaml` after `-f compose.yaml`
in the startup command above. Open `http://localhost:8025` to view captured
messages. No SMTP account or manually generated keys are needed: the initializer
persists independent recovery keys and a local TLS certificate in a named volume.
`pnpm dev:mail:check` verifies worker health and sends/removes one synthetic TLS
probe; it does not trigger a real account recovery. Use the account security
settings to verify a recovery address before testing password reset.
`pnpm dev:mail:logs` shows the app, mail-worker and capture logs;
`pnpm dev:mail:down` stops this stack while preserving data. To return to basic
development, run that stop command before `pnpm dev:docker:up`.
Mailpit never relays captured mail externally. Details: [Operations](docs/OPERATIONS.md#optional-local-mail-capture).

Use `pnpm dev:host` only when PostgreSQL, storage, scanner settings and the rest of the development environment are already configured outside Compose. It starts only the Next.js app and intentionally does not provision dependencies.

In development, `/dev` shows a sanitized runtime status panel for the application, database, storage, scanner and email mode. The route is intentionally unavailable when `NODE_ENV=production`.

The development stack starts PostgreSQL, ClamAV and the Next.js application. Database migrations run before Next.js starts. Application and workspace `src` directories are bind-mounted read-only into the container, so normal source edits hot-reload without rebuilding the image.

If port 3000 is busy:

```bash
NEXUS_DEV_PORT=3001 docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

Useful commands:

```bash
# health/readiness
pnpm dev:docker:check

# logs
docker compose -p nexus-local -f compose.yaml logs --tail 100 --follow app push-worker postgres clamav

# stop, preserving data volumes
docker compose -p nexus-local -f compose.yaml down
```

Changes to package manifests, Dockerfile, installed dependencies or image-level tooling still require `up --build`. Migration changes require the app startup path to run again; do not point this stack at production data.

Useful host-side commands when Node 26 and pnpm 12 are installed:

```bash
# preflight: Docker, Compose, port, required files and local compose rendering
pnpm dev:preflight

# full foreground development stack
pnpm dev

# detached full development stack
pnpm dev:docker:up

# Next.js only; external dependencies must already be configured
pnpm dev:host

# code checks without Docker or PostgreSQL
pnpm check:code

# full project verification with configured dependencies
pnpm check
pnpm nexus:doctor

# dependency boundaries, unused-code report and production bundle report
pnpm analyze:architecture
pnpm analyze:unused
pnpm analyze:bundle

# focused public catalog, saved/library and admin-count checks (no local database)
pnpm test:catalog

# report privacy, audit transaction and moderator notification checks
pnpm test:reports

# generated trusted-proxy/IP cases, with a reproducible seed
pnpm test:properties
```

Browser acceptance also runs axe-core WCAG checks for account forms in RU/EN,
light and dark themes, plus open dialogs and authenticated screens. Rule and
element diagnostics are retained with the CI browser reports. See
[Operations](docs/OPERATIONS.md#automated-browser-accessibility) for coverage and limitations.

## Demo data / Демонстрационные данные

After migrations, populate or safely repeat the development baseline:

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed
```

Seed creates real ZIP fixtures for both inventory and drift resources, recording
actual byte lengths and SHA-256 hashes. Each archive contains README.txt and
meta.xml only; neither implements the advertised game system. New demo resource
descriptions explicitly say so. Fresh baseline data contains no remote avatar,
banner, thumbnail or article-cover URLs; the UI exercises its built-in fallbacks
instead of depending on Unsplash/DiceBear. Production seed is rejected.

The database baseline is transactional and serialized between seed processes.
Reruns insert missing records and preserve existing passwords, roles, content
edits and moderation states. Reserved IDs or unique slugs belonging to other
records cause an error, not an overwrite. A missing demo build is not recreated
for a product whose current version or publication state has changed.

Legacy demo metadata is detected rather than silently repaired. After inspecting
the conflict, repair only the known demo builds with:

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed:repair
```

This updates only size/hash metadata after fixture identity checks. It never
replaces a different existing file or resets moderation status. Older development
volumes that still contain the exact legacy CDN media values can be cleaned
separately:

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed:repair-media
```

Media repair clears only exact URLs previously written by the NEXUS demo seed;
custom replacements are preserved. For host execution, use
`STORAGE_PROVIDER=local` and an **absolute** `STORAGE_LOCAL_PATH` shared by
the app and seed. Prepared ZIPs may remain after a database rollback;
reruns reuse identical files. Verify claim/download in your development stack.

## Development rules / Правила разработки

- `main` is the only maintained development branch.
- Do not interpret a merged commit as production acceptance.
- Paid checkout, stored-value balances, payouts and crypto settlement stay disabled.
- A resource build is publicly usable only when it is published and has a trusted clean scan with scanner identity and scan timestamp.
- Free-resource claims require an actually downloadable safe build.
- Production configuration stays fail-closed; development defaults must never be reused as production secrets.
- Do not force production data into local migrations or test flows.

## Project map

```text
apps/web/          Next.js application, routes and UI
packages/db/       PostgreSQL schema, migrations and repositories
packages/domain/   domain types, errors and events
packages/security/ authorization, IDs and rate limiting
packages/storage/  private local storage abstraction
packages/ui/       shared UI primitives
packages/config/   environment validation
packages/validation/ request schemas
scripts/           operational and verification tooling
tests/             unit, integration and contract tests
```

The free resource library at `/market` supports category and text search, three sort modes and bounded pages. `/api/products` accepts `type`, `sort`, `q`, `page` and `limit` and returns `products`, `limit`, `page` and `hasMore`. Published resources must still have a trusted clean build. Saved items, personal libraries and public profiles query their own IDs or owners, so older resources are not lost behind the catalog's first page. The personal library also shows active, unexpired legacy licenses without exposing their keys or repeating resources already claimed through newer access records.

The account-scoped resource cart at `/workspace/cart` holds up to 20 free resources. `/api/resources/cart` supports GET/POST/DELETE; POST `/api/resources/cart/acquire` takes the reviewed `productIds` and a UUID `requestId`, grants access atomically and stores a replay receipt. It never creates a payment or paid order. Library and resource pages link to this flow.

Authors can archive a resource, restore it as a draft and submit its latest clean draft version for moderation from the resource workspace. Restoring requires renewed moderation of formerly public versions; suspension cannot be bypassed. Existing grants, files and history are retained. Private historical order details are available at `/workspace/purchases/[id]` and `/api/orders/[id]`, scoped to their buyer and separately checking current download rights. Migration `0039_resource_cart` adds the cart, replay receipts and the order-item lookup index.

Existing finite single-server licenses can be managed at `/workspace/licenses/[id]`: bind an approved server-control proof, create/rotate a hash-only runtime bearer token (at most 30 days and never beyond the recorded license expiry), revoke the token or revoke the license. `/admin/licenses` provides scoped moderation, reasons and revision checks; restoration preserves the original term and clears old tokens. Migration `0040_license_runtime_controls` preserves bindings across server deletion and endpoint changes. HTTPS `POST /api/licenses/check` accepts `Authorization: Bearer <token>` and JSON `{ "serverId": "bound server ID" }`; checks current proof, permissions, endpoint, license expiry and clean published builds. This checks a credential and binding, not the physical caller or source-code DRM. Paid issuance and renewal remain disabled.

Resource variant groups are managed at `/workspace/resources/[id]/variants`: link and order up to 12 independently moderated free resources from one publisher. Each keeps its own files, versions and grants; marketplace choices hide drafts, unsafe releases and groups with an unpublished anchor. `/workspace/resources/[id]/compatibility` edits minimum MTA version and declared dependency slugs with revision checks and audit. Migration `0041_resource_variants` is required. These catalog links do not enable paid SKUs or cross-resource access. Reviewer downloads recheck the current moderator role and exact build evidence transactionally after opening storage.

Migration `0043_resource_acquisition_activity` records newly issued free grants atomically with their entitlement. `/workspace/acquisitions` and GET `/api/acquisitions` provide buyer-scoped, paginated history with direct/cart filters and current access checks; older grants and imported licenses are not reconstructed as purchases. Both cart and individual claims preserve an active legacy license without creating permanent access. `/workspace/resources/[id]/activity` and GET `/api/products/[id]/activity` show private publisher aggregates for 7/30/90/365 UTC days; `/activity/export` exports daily CSV counts without buyer identities. These are free grants and authorized download starts, not revenue or completed transfers. Customer downloads now revalidate live management/access grants and exact build evidence after opening storage, then audit the start transactionally. Personal historical sales exclude organization resources.

## Documentation

Resource reviews now have an acquired-access workflow at
`/workspace/library/review/[id]`, a private archive at `/workspace/library/reviews`
and 20-item public pages at `/market/[slug]/reviews`. Publishing or editing locks
current publisher authority, entitlement/license expiry and a safe release; authors
can withdraw a review after access expires. Ratings exclude withdrawn/removed
reviews and do not change the resource's metadata revision. Historical acquisition
flags are not presented as verified payment or newly checked access.
Reports use `/workspace/review-reports` and `/admin/commerce/reviews`, independently
of community discussion cases. Moderation checks live roles, report state and the
exact review revision; removal and rating repair commit with the report and audit.
Migration `0050_resource_review_lifecycle` must be applied before these routes.

The repository keeps three operational long-form documents at the root of `docs/`:

- [Architecture / Архитектура](docs/ARCHITECTURE.md)
- [Operations / Эксплуатация](docs/OPERATIONS.md)
- [Problems / Реестр проблем](docs/PROBLEMS.md) — the single open-problem registry

The owner-confirmed product specification and AI development handbook lives in
[docs/handbook/](docs/handbook/00-README.md). Start with the
[Decision Register](docs/handbook/13-DECISION-REGISTER.md), then read
[Source of Truth and Repository Handoff](docs/handbook/58-SOURCE-OF-TRUTH-AND-REPO-HANDOFF.md)
and the relevant domain chapters.

The handbook describes the approved target product. It does **not** imply that
future commerce, DRM, subscriptions or other target features are already active
in the current closed-beta runtime. Current operational truth, release gates and
verified implementation state remain in Architecture, Operations, Problems,
executable code, migrations and tests.

**Development handoff:** product intent and precedence are defined by the handbook;
the ordered operational continuation and release procedure remain in
[Operations / Эксплуатация](docs/OPERATIONS.md#7-codex-handoff--передача-разработки-codex).

## Release state

This repository is a closed-beta codebase. Production deployment is a separate operational decision and requires successful verification of the exact `main` SHA, backup/restore readiness, configured production secrets, TLS, storage, malware scanning and recovery delivery.

MTA NEXUS is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.


Organization workspaces are available at `/workspace/organizations`: create a
profile, manage existing Nexus team accounts and delegated MTA server access, or
leave a team. Owner/admin boundaries and the shared revision are checked under
transaction locks; existing resource permissions are preserved. Article and
community discussions support author identities, replies and 20-item keyset
pages through `/api/content/[slug]/comments` (GET/POST), with RU/EN interfaces.

Actual organization owners can transfer ownership to a current team member with
an exact organization confirmation and a chosen retained member/admin role.
`/workspace/organizations/[id]/activity` exposes private, 20-item audit history
to current owners/admins. Transfers and team access changes store inbox notices
atomically; optional push delivery uses the existing outbox. These flows support
RU/EN, stale-version checks and recovery after an uncertain response.

`/support` and `/admin/support` now preserve subject/case-number search,
status/category filters and pagination in their URLs. Requesters can resolve
their own case and reopen a resolved case; only current staff can close or reopen
a staff-closed case. Thread forms submit the observed revision, while durable
reply retries retain the original revision and request key. Private status
history is available in each thread through `/api/support/[id]/activity`.
Requester notices for staff replies and status changes share the authoritative write and
use the existing push outbox; notification previews omit private case text.
Both languages include metadata, recovery and confirmed saved-state feedback.

`/discover`, `/developers` and `/organizations` support paginated search and
public filters through `/api/discover`. `/workspace/saved` manages all four
existing follow types with private 20-item pages, search and removal, including
unavailable targets. Public user/creator/organization profiles expose working
follow controls; `/api/follow` accepts idempotent desired-state POST/DELETE commands.

`/workspace/feed` shows public publications from all four follow types with
search, type/source filters and 20-item cursor pages. Public publication history
is available at `/users/[username]/activity` and `/organizations/[slug]/activity`,
backed by `/api/activity/[kind]/[handle]`. Authors can edit or remove their
discussion comments; moderators can remove another comment with a reason through
`/api/content/[slug]/comments/[id]` (PATCH/DELETE). Live authority, text revisions,
comment counters and audit are checked transactionally. Replies remain after a
parent is removed. These operations do not modify product reviews.

Publication and discussion pages now expose working abuse-report forms.
`/workspace/reports` and `/workspace/reports/[id]` provide private, filtered
20-item report history and current public target previews. `/admin/reports`
and `/admin/reports/[id]` provide a community moderation queue, staff evidence
review and status decisions through `/api/admin/reports`. Removing a reported
discussion comment, updating its counter, resolving the report and both audit
entries share one transaction with live role, report-state and text-revision
checks. Replies remain; product review comments are excluded. Reporter status
notifications contain no staff notes. All new surfaces support RU/EN.

Commercial plan administration is available at `/admin/commerce/plans` to live
administrators. RU/EN terms, price, 7/30/90/365-day duration and commission benefits
are versioned and audited; editing withdraws a published plan until it is reviewed
and published again. `/subscriptions` lists published announcements and estimates
integer platform fees from a 10% base with the original 7-day hold. Subscription
activation, paid checkout and withdrawals remain unavailable.

Buyers can inspect recorded payment attempts and cancel a pending order at
`/workspace/purchases/[id]/operations`. Cancellation requires no payment attempt
or ledger reference of any type, compares the displayed order revision and stores
an idempotent receipt and audit atomically. It creates no refund or entitlement.
Migrations 0045–0047 add these contracts and Agent B's publication/report indexes;
apply them before using the new routes.

`/admin/resources` provides current moderators with a searchable, paginated
resource queue, suspension and release decisions with publisher-visible reasons.
Release returns the resource and its published/pending releases to draft for a
new review; quarantined releases remain quarantined. The publisher sees the
decision history at `/workspace/resources/[id]/moderation`, without historical
internal staff notes. All decisions hold live staff authority and compare the
displayed resource revision through the atomic audit commit.

`/workspace/library/updates` lists approved releases for effective buyer grants
and legacy licenses. `/workspace/library/[id]/versions` saves latest/fixed download
preferences with revision checks and idempotent replay. Main library downloads
honor a fixed selection and fail closed when that release is withdrawn. Preferences
never mint rights, confirm installation or change license/server bindings.
Apply migration `0048_resource_release_controls` before using these RU/EN surfaces.

`/workspace/finance` exposes private, currency-separated recorded balances and
20-entry statements for personal accounts and organizations owned/administered
by the current user. Legacy descriptions and payment secrets are excluded.
Held and withdrawable sums remain unreconciled until a real payment provider
and hold allocation exist; a recorded balance never enables a payout.

`/admin/commerce/reconciliation` provides live administrators with a read-only
queue of amount/currency mismatches, multiple or missing recorded captures,
cancelled references and missing/unbalanced ledger evidence. It offers no manual
payment confirmation, refund or order repair. Internal ledger posting now uses
idempotent immutable batches, separate currency balancing, sorted order/account
locks and PostgreSQL-computed balances. Apply migration `0049_financial_journal`.
Paid checkout, automatic commissions, seven-day hold allocation and payouts remain
disabled; a balanced journal is accounting evidence, not provider settlement.

Resource version workspaces: publishers can withdraw a pending version, edit draft/rejected
release notes and MTA targets, resubmit a provenance-backed clean archive, and retire a
version at `/workspace/resources/[id]/builds/[buildId]`. Staff inspect the bounded decision
history at `/admin/resources/[id]/builds/[buildId]`. Author commands and approval/rejection
require the observed build revision; migration `0051_resource_build_workspace` is required.
Uploaded archives/version identifiers stay immutable. Changing files requires a new upload.
