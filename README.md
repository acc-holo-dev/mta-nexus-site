# MTA NEXUS

Discussion recovery now offers a bounded `--dry-run` source preview in a read-only
database snapshot, without checkpoint access or notification/push writes. Delivery
and preview reject windows ending after PostgreSQL time. Workers retry recognized
temporary database/network failures and stop on scope, permission, schema or checkpoint
errors. See [Operations](docs/OPERATIONS.md#previewing-a-discussion-recovery-window).

The private collection inventory now finds resources across every own collection,
deduplicates reference IDs and shows all current active/archived memberships with
revisions and entry dates. Literal accessible-title/recorded-ID search, collection/status
scopes and available/unavailable/shared filters retain whole membership lists.
Unavailable labels stay masked while orphan IDs remain manageable. A twenty-resource
page includes links to membership management, own collection details and comparison,
plus bounded private JSON export. Counts and effective access share one database-time
read-only snapshot. No migration or mutation is introduced.

Private collection commands now have stable receipt detail and bounded JSON export.
Reconciliation receipts offer reviewed inverse additions/removals under current own
collection state and access. Already restored references stay unchanged, unrelated
later references/dates are retained, and missing access blocks restoring a reference.
Selected inverses use existing atomic UUID reconciliation commands with new receipts;
immutable original proof remains readable. The review survives uncertain retries and
server refresh after no inverse differences remain. No additional migration is required
beyond `0078_library_collection_reconciliation`.

Private collections can now be reconciled against portable JSON with a reviewed
selection of missing references to add and extra own references to remove. Up to
twenty mixed changes commit atomically with one revision, immutable receipt and
required audit; full collections can swap references within net capacity. The file
never grants rights: additions recheck current own access, removals allow orphans,
and finite expiry is checked after all required writes. Exact UUID replay preserves
the original proof after later edits or lost access. Private history matches either
side and displays the whole operation. Migration `0078_library_collection_reconciliation`
retains previous receipt guards and adds bounded disjoint membership postconditions.

New discussion notices retain transactional push-admission receipts. Explicit
`notifications:replay ... --repair-push` recovers only proven pending, unread,
unexpired notices under current access/preferences, without repeating queued pushes
or enrolling later devices. Repair uses a new scope/policy-bound checkpoint; queue
failures retain the current audience page. See [Operations](docs/OPERATIONS.md#recovering-proven-missing-discussion-push-jobs).

Private collections now support portable JSON export and reviewed additive import.
Export includes the complete bounded collection snapshot and up to 200 reference IDs,
including orphans, without resource titles or access metadata. Import accepts files or
pasted JSON up to 64 KiB, previews existing references and current own access/capacity,
then adds up to twenty selected references through existing atomic UUID commands.
File contents never grant rights; additions recheck access and revisions when saving.
The shared batch controller invalidates stale review, respects remaining capacity and
keeps the parent import fixed through uncertain retries, with saved receipt/history links.
No new migration is required.

Own resource membership groups now have a private RU/EN history, stable receipt detail
links and bounded JSON-page export. Filters cover 7/30/90/365 days, additions/removals/
mixed groups, collection and resource IDs; every matching group retains all children.
Shared strict receipt validation separates immutable names/revisions/membership proofs
from current own collection state. Lost access or resource deletion masks the current
resource label without removing historical proof or its stable detail. All reads use an
owner-scoped, read-only database snapshot. No new migration is required beyond 0077.

Resource collection memberships now support reviewed atomic updates across up to
twenty active own collections in one operation, including mixed additions/removals.
Every reviewed revision and prior membership is checked before mutation, all changes
share one transaction, and immutable ordinary collection receipts remain in history.
A parent UUID receipt proves the whole group and supports exact replay after later
edits/access loss. Additions require current database-time access/capacity; orphaned
references remain removable. Migration `0077_library_membership_batches` adds guarded
parent receipts, bounded history and immutable child association.

Interrupted discussion inbox delivery can be replayed over a fixed UTC window with
bounded fifty-follower pages and resumable page checkpoints. An optional background
worker retries failures and drains that window; private atomic checkpoint writes
flush the file and parent directory. See [Operations](docs/OPERATIONS.md#recovering-discussion-inbox-delivery)
for invocation, lock inspection and current recovery limits. New checkpoint files
are bound to the database/table scope; old files require explicit `--adopt-legacy`.
Pass logs expose aggregate delivery/retry outcomes without recipient metadata.
This does not yet
automatically enqueue or discover pending fan-out after new comment writes.

Own collections now have a private RU/EN comparison view with common/source-only/
destination-only/unavailable filters and literal accessible-name search. Review twenty
references per page, then copy or move selected source references using both collection
revisions and existing immutable UUID commands. Archived sources remain copyable,
read-only destinations stay inspectable, and unavailable/deleted references keep masked
names. Comparison snapshots include bounded counts and own target choices, never file
metadata or download rights. No new migration is required beyond existing collections.

The private collection command center now inspects all own immutable receipts over
7/30/90/365-day windows, with operation, participating collection and recorded resource
filters and bounded JSON-page export. Historical results and current collection/resource
state are displayed separately; unavailable resource titles are masked and unknown proof
is neutral. Grouped add/remove freezes UUID, destination/revision and reviewed references
across uncertain retries, requires reload after definitive errors and ignores late replies.
Migration `0076_library_collection_account_history` adds the owner/time/id read index.

Each acquired resource now has a private RU/EN collection-membership screen showing
all own collections, counts and revisions. Add/remove uses existing UUID commands;
known references remain removable after lost access or product deletion, with hidden
unavailable titles. Archived/full/terminal collections explain their constraints.
Single collection commands freeze their endpoint and proof across retries, require
reload after definitive failures and ignore late responses after unmount. No new
migration is needed; existing collection migrations through `0075` are prerequisites.

Collections now support reviewed atomic moves of up to twenty references between
existing active collections. Both revisions advance together, existing destination
entries keep their dates, and one immutable UUID receipt appears in both histories.
Source successor evidence is confirmed alongside the destination snapshot. Migration
`0075_library_collection_item_moves` extends receipt guards and indexes source history.

Collections now support reviewed copying of up to twenty selected references into
another existing active collection, including unavailable/deleted references and
archived sources. Both revisions and exact source membership are checked; existing
destination entries are retained, with immutable UUID receipts and atomic audits.
Migration `0074_library_collection_item_copies` extends database receipt guards.

The release-watch center supports reviewed group resumption of up to twenty existing
stopped watches with current access/safe-publication/revision/quota checks. It skips
already approved releases, preserves saved version choices and notices, and records
resumption in private command history. Migration `0073_release_watch_resume_history`
extends the own-command history index.

Individual and grouped release-watch commands now keep their reviewed resource/scope
and revisions across uncertain retries. Definitive errors require reload; leaving the
screen aborts the request and ignores late responses. Single changes and the release
worker check finite access at database time after waiting for locks, guard saved state
and keep update timestamps/progress monotonic.

The private release-watch center now provides command history across individual changes,
bulk stopping and collection enrollment. Inspect 7/30/90/365-day windows, filter recorded
resource IDs or operation sources, and export a bounded twenty-operation JSON page.
Current labels require current access/safe publication; lost access preserves recorded IDs.
Malformed evidence remains unknown. Migration `0072_release_watch_history_index` supports
scoped audit reads. History links to current controls without replaying past operations.

Collections now offer reviewed enrollment in future-release notifications for up to
20 resources at once. The RU/EN watch screen shows current membership, availability,
watch state and the account-wide quota; archived collections remain inspectable. Apply
checks collection/watch revisions, locked current access and clean publication together.
Enrollment skips earlier release events, preserves version pins and supports exact-state
retry acknowledgement. Collection detail/release screens link to the new watch view.

Release watches now support title search, private twenty-row JSON exports and reviewed
bulk stop for up to 20 enabled watches, including resources with lost access. Revisions
are checked together in one audited transaction; mixed/stale states conflict. Uncertain
results retry the exact selection. Existing notices and processing cursors are retained.
Search considers only currently accessible safe resources and uses database snapshot time.

Release comparison now links both exact releases to buyer preparation previews. Inspect
a candidate before choosing it, retain the comparison pair/page while checking an MTA
version, and export the same private report. Only the root build is previewed; dependency
choices stay current. Preview does not save preferences and offers no download controls.
Library preparation now uses a read-only database-clock snapshot for effective access.

Individual version choices now retain the exact submitted command when a response is
lost or cannot be verified. RU/EN controls offer a precise retry or a full state reload
before another choice. Definitive rejections require reloading. Single selection writes
recheck expiry against the database clock after locks, protect revision updates and
reject unexpected insert races without an audit or preference overwrite.

Comparison now offers an explicit, reviewed choice of its target release for downloads.
The comparison snapshots the actor's preference revision alongside the releases;
a confirmation checkbox binds the choice to the displayed archive hash and size.
Saving rechecks those observations, clean publication and current access under locks.
Lost responses retain the same reviewed command through the shared selection recovery.
Comparing or exporting alone does not alter the preference or grant a file.

Buyers can now compare two exact, currently accessible safe releases before changing
version preferences. RU/EN comparison shows archive identity/size, published notes,
declared MTA/signing metadata and the established public package summary. The summary
is bound to each artifact's recorded hash/size; missing or malformed evidence remains
unknown. Version screens link from the current selected release to another release,
preserve the return page, support reversing the pair and offer bounded private JSON.
No private file inventory, ACL declarations, storage keys or automatic selection change
is exposed. Both releases and current resource rights are rechecked for every report.
Webpack memory optimizations and two build workers also bound compilation/route
collection memory in constrained environments.

The buyer library now exposes private version-selection history across individual
and group changes. Filter by a resource and 7/30/90/365 days, inspect twenty-row pages
and export bounded JSON. Only the current user's recorded choices are projected;
raw audit details, IPs and user agents are excluded. Lost access preserves recorded
IDs while current titles/release labels require safe publication and effective access.
Migration `0071_library_selection_history_index` adds the scoped history index.
The history screen records past choices without restoring versions or granting files.

Collections now provide a private release overview: compare pinned and latest safe
builds, filter updates/fixed/unavailable selections, search accessible names and
export a twenty-row JSON page. Current access, collection membership, counts and
versions are read in one database-clock snapshot. Lost references remain visible
without resource metadata; withdrawn pins never silently fall back to another build.
The RU/EN overview links to existing individual and reviewed group version controls.
Archived collections remain inspectable. No migration or automatic update is required.

Private collections can now be copied in full, including up to 200 retained
references from active or archived sources. The source review binds its revision,
count and exact composition; the new collection is independent and starts active.
Migration `0070_library_collection_copies` validates source ownership and exact
copied membership for immutable receipts. RU/EN confirmation, private JSON review,
recorded provenance, same-UUID retries and atomic audits reuse existing limits.
Copying references leaves library-wide version preferences and resource rights intact.

Collections now support atomic membership batches: select up to 20 acquired
resources to add, or remove up to 20 private references together, including
unavailable resources. RU/EN controls require explicit confirmation; uncertain
results retry the same UUID and canonical command. Migration
`0069_library_collection_batches` preserves old receipts and validates bounded
batch IDs against final membership. Quotas, current access, collection revision,
receipt and mandatory audit are checked within the same transaction.

Collections now support reviewed version batches: choose up to 20 existing
members, preview exact selected builds, then atomically pin them or follow
latest releases across the library. Migration `0068_library_selection_batches`
retains immutable, private operation receipts and paginated JSON history.
Changes in membership, selections, available builds or access invalidate review;
ambiguous retries reuse the same command without applying a second batch.

Private collections now include a whole-collection readiness report, an MTA
version check and private JSON export. Shared dependencies and selected builds
are checked together in one read-only database snapshot, with bounded graph
traversal and masked unavailable members. Open a collection and choose
**Collection readiness**; downloads still independently verify current access.

The buyer library now supports private resource collections: create/rename,
archive/restore, add acquired resources, remove references after lost access,
search, paginated views and immutable command history/private JSON. Migration
`0067_library_collections` guards revisions, ownership, quotas and receipts.
Collection membership never grants files: current access, safe publication and
selected-version checks continue to apply to every download.

Published zero-price plans can now be activated for a personal account or a managed
organization. Migration `0066_account_subscriptions` enforces one current period,
records immutable plan terms and fixed 7/30/90/365-day expiry, and protects terminal
states. RU/EN account controls, cancellation, receipts/history/JSON and a private
fee estimator use live financial grants and idempotent audited transactions.
Expired or ended plans restore the estimator's base 10%; the seven-day initial
hold remains separate. Paid activation requires a provider and stays unavailable.

Publishers can copy a managed free resource into an independent unreviewed draft
with a new title/address and the same publisher. Description, tags, type and
compatibility are copied; files, versions, approval and commercial rights are not.
Migration `0065_resource_draft_copies` adds immutable creation receipts. Live grants,
source review digests, bounded quotas and idempotent retries protect creation;
RU/EN author screens offer private history and JSON exports.

Publishers can now manage an uploaded resource gallery: up to eight static
PNG/JPEG/WebP images, captions, ordering and a first-image cover. Canonical PNG
conversion strips source metadata and has byte/pixel/concurrency limits; scanning
must succeed before storage. Migration `0060_resource_media` preserves existing
external previews until gallery edits, makes stored image identity immutable,
and returns gallery/editorial changes to draft for renewed moderation. Private
RU/EN author/staff screens and public marketplace galleries use live access checks;
image delivery verifies full stored bytes before emitting PNG, with no-store headers.
Removed references and uncertain commits retain private storage objects for a future
orphan sweep. Live PostgreSQL and browser verification remain required.

Version uploads now inspect standard stored/deflated ZIP packages before scanning
or storage. Unsafe paths, duplicate/link entries, inconsistent headers, CRC failures,
unsupported features and bounded inflation failures reject the upload. Migration
`0059_build_package_evidence` records immutable evidence bound to the exact file
hash/size, including per-file SHA-256 and bounded static `meta.xml` notes. Other
supported formats explicitly remain structurally uninspected; older builds receive
no inferred report. The malware scan and moderation gates still apply.

Publisher/staff version screens link to a private JSON report and file comparison
at `.../builds/[buildId]/package`. Filters show added/removed/changed/unchanged files,
20 per page, under live personal/organization/moderator grants. Default comparison
uses an earlier safe published version; missing inventories remain unknown.
Public release history receives only counts and aggregate notes. No source paths,
ACL names, raw XML or file contents cross that public projection. Static package
inspection does not prove MTA execution, complete XML validity or source-code DRM.


MTA NEXUS is a player-first Multi Theft Auto: San Andreas platform for live server discovery, community updates, and safe free-resource distribution.

**Current repository version:** `1.2.0-beta.3`  
**Active development branch:** `main` only.

Русский интерфейс и English interface use the same application. Change the language with the language button in the top navigation; the preference is stored in the `nexus_locale` cookie. The global shell, home, resource catalog/cards, workspace, server directory, authentication, errors and metadata now use the shared dictionary.

## Local development / Локальная разработка

`/subscriptions` now links to private saved plan reviews for personal and
organization accounts. Migration `0064_plan_reviews` records the selected
published version and an illustrative integer fee calculation, with immutable
terms, atomic audit and exact-request retries. `/workspace/subscriptions/reviews`
provides 7/30/90/365-day history, twenty-record pages, current-version comparison
and bounded JSON export. Organization owners/admins share that account's reviews;
live rights are checked on every read and retry. There is a 500-review account
limit. A review reserves no price, activates no subscription and changes no funds
or license rights; the provider integration remains pending.

`/workspace/sales/report` provides private RU/EN reports for the current personal
or organization portfolio, with resource, currency, 7/30/90/365-day, order and
payment-record filters. Owners and current organization admins can inspect scoped
line details, per-currency totals, UTC periods and displayed-page CSV. Payment
attempts never multiply line values; unknown currencies are not summed. Labels
describe database evidence, not external provider verification or available funds.
Earlier seller attribution was not recorded and is not inferred. Migration
`0062_seller_sales_indexes` adds two lookup indexes without rewriting old orders.

Migration `0063_order_terms` freezes new order-line product titles, seller identity,
line prices and declared license model at insertion. Stored 10% commission and
seven-day hold values describe the baseline, not applied fees or available funds.
Buyer order details and admin reconciliation link to private RU/EN terms reports
with integrity checks, twenty-line pages and bounded JSON exports. Legacy terms
remain unknown; snapshots do not confirm payment or grant download/license rights.
Pending-order creation validates locked catalog prices and safe releases, records
an atomic audit, and permits only exact retries of the same pending request.
Seller reports can select recorded seller attribution, retaining frozen titles
after catalog ownership changes; earlier lines without snapshots are excluded.
Paid checkout remains closed. Live PostgreSQL migration/race checks remain required.


Migration `0058` adds reviewed free-cart receipts. In `/workspace/cart`, inspect
the approved builds, archive hashes/sizes and declared MTA requirements before
confirming. Acquisition compares that exact review under the resource/build
locks and refuses a changed selection. The request key also binds the review;
an uncertain result can safely retry the same request after the cart clears.
`/workspace/acquisitions/receipts` provides RU/EN 7/30/90/365-day and evidence
filters, twenty-item pages, displayed-page CSV and immutable receipt details.
Recorded public snapshots survive resource deletion; exact-version downloads
still require current access and a safe build. Earlier receipts retain absent
version evidence. This records free library operations, without confirming file
delivery or activating paid checkout. Saved download pins remain unchanged.

Migration `0057` adds opt-in notices for future approved resource versions.
Buyers enable them on the version page and manage up to 100 active watches at
`/workspace/library/watches` in RU/EN. Each approval records durable work; retained
artifacts reviewed again do not repeat release notices. Delivery rechecks live
access, the exact safe published build and commerce notification preferences.
Revoked or expired access disables the watch. Re-enabling starts after current
events; historical releases are not sent, and download pins remain unchanged.
The bounded `resource-release-worker` starts after app readiness in both Compose
environments and uses the existing inbox and optional Web Push outbox.
Standalone execution requires `NEXUS_RESOURCE_RELEASE_WORKER=true`; run
`pnpm --filter @nexus/db resource:notify --once` or `--loop`.

Migration `0056` records private resource delivery receipts at the final live
authorization gate. `/workspace/library/downloads` provides RU/EN status and
7/30/90/365-day filters, bounded page CSV, exact-version receipts and retries
subject to current access. Streaming checks emitted size and SHA-256 and records
server completion, cancellation or failure. Completion does not confirm browser
file saving; interrupted result persistence remains unconfirmed. Authors see
version aggregates without buyer identities at `/workspace/resources/[id]/deliveries`.
Historical start audits are not converted into successful delivery evidence.

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

Buyers open order-linked support at `/workspace/purchases/[id]/support` and
track it at `/workspace/order-cases`; staff review the corresponding private
queue at `/admin/commerce/order-cases`. RU/EN intake supports payment/resource
issues, refund requests and disputes. Immutable recorded-order snapshots,
idempotent intake, revision/evidence checks, review history and the existing
support conversation require migration `0052`. Refund recommendations do not
execute refunds or change orders, balances, licenses or access. Paid provider
settlement and financial refund execution remain unfinished.

License owners can reconfirm the same server after an endpoint change at
`/workspace/licenses/[id]`, once its fresh control proof is approved. Migration
`0053` records server ownership, protects the original finite term and retained
server identity, and clears credentials on recovery or status changes. Historical
bindings with unknown ownership require explicit reconfirmation. Private owner
and staff history pages show all license events in pages of 20.

The one-time runtime credential panel can check an exact published build using
`POST /api/licenses/check-release`: bearer token plus `serverId`, `productId`,
`buildId`, `sha256Hash` and UUID-v4 `nonce`. The server rechecks current license,
control proof, grants, endpoint, owner and safe release; successful responses echo
the nonce and expire within 60 seconds or the earlier recorded term/token expiry.
This checks a saved release hash and credential, without attesting the calling
machine or installed files. It grants no downloads and is not source-code DRM.
Paid license issuance/renewal and an enforced MTA DRM client remain unfinished.

Migration `0054` adds exact-term, immutable processing events. The bounded
`license-worker` in DEV/production Compose starts after app readiness, warns once
within three days and marks finite active/suspended terms expired while clearing
runtime credentials. It preserves recorded expiry, purchases and unknown terms;
inbox notices respect commerce preferences and reuse the push outbox. Runtime
and download checks continue to enforce expiry independently of worker progress.
Standalone execution requires `NEXUS_LICENSE_MAINTENANCE=true`; use
`pnpm --filter @nexus/db license:maintain --once` or `--loop`.

The RU/EN license archive at `/workspace/licenses` supports search, effective
status, server-binding and term filters, expiry sorting and a safe CSV of the
displayed page. Filters survive navigation and export. Only current administrators
can inspect pending expiry/warning counts and unknown terms at
`/admin/licenses/maintenance`; the view issues or renews nothing.

Resource publishers now search/filter `/workspace/resources` by type, publisher
scope, status and actual clean-version readiness. Filters and counts survive
pagination. `/workspace/resources/[id]/history` shows the complete recorded
editorial/publication history in private pages of 20, without backfilling events.

Migration `0055` withdraws publication after future title, description, tag or
requirement changes and returns pending versions to drafts with new revisions.
Archived/suspended metadata is read-only. Submit a retained clean published
archive when no eligible draft exists; re-uploading the same version is unnecessary.
Only a new successful review clears the editorial requirement. Rejection, version
retirement and quarantine restoration keep it withdrawn. Reviewers inspect the
description/requirements on the version detail page; repeated decisions notify
once per reviewed revision. Files, grants and financial records remain intact.

Developers edit specialties, portfolio and Discord in `/settings/developer`.
Public profiles show these contacts and the separate verified-experience flag.
Changing specialties or portfolio removes that flag. `/workspace/verification`
supports private evidence submissions, current status and paginated feedback for
identity, developer experience and managed organizations. MTA ownership keeps its
control-challenge flow. Moderators review current profile/authority context at
`/admin`; profile revisions, live roles and independent approval are checked in
the same transaction as the decision, audit and requester notification. Both
languages include errors, metadata, saved-state recovery and navigation.
`/workspace/verification/history` searches own applications with bounded keyset
navigation. Private application cards let authors replace pending evidence and
resubmit their current professional profile; moderators decide the observed
evidence revision. MTA proofs and resolved applications remain read-only.

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


Storage maintenance (migration `0061_storage_maintenance`): admins can discover
local private upload objects at `/admin/storage`, inspect references and age,
and confirm cleanup of a single object. Discovery visits at most 100 directory
entries and hashes at most 128 MiB per window; offsets stop at 10,000 entries.
Directory changes can shift windows, so rescan rather than treating discovery
as a complete atomic inventory. Unknown names, temporary files, symlinks,
hardlinks and unsafe artifacts are preserved. The storage root must be trusted.

Cleanup requires seven days of file age and no references from **any** build,
gallery or `assets` record. A transaction retires the key permanently before
filesystem removal; database triggers reject late references and stale snapshot binding writes
(new bindings require READ COMMITTED). Deletion rechecks
the captured inode, device, timestamps, size and SHA-256. A changed object is
preserved and a missing object does not count as freed bytes. Interrupted
operations retain a two-minute lease and can be retried after it expires;
request loss may leave an unknown outcome until refreshed. Failed removal is
retryable; changed/deleted/missing outcomes are terminal. Staged `.cleanup`
artifacts with changed content require manual recovery by the operator, never
an automatic second deletion. No bulk cleanup or background deletion runs.
Other storage providers fail closed until they implement conditional maintenance.
Financial holds, grants, license terms and payment states remain unchanged.


Resource preparation: `/workspace/library/[id]/requirements` inspects transitive
catalog dependencies, effective access and pinned/latest release selections.
Publisher and moderator screens at `/workspace/resources/[id]/requirements` and
`/admin/resources/[id]/requirements` support exact build previews from the build
page. All views offer RU/EN diagnostics and private JSON export. The graph stops
at 48 resources / eight levels and reports cycles, unavailable dependencies,
missing access, package uncertainty and declared minimum MTA version comparisons.
A bare MTA release cannot establish a minimum build number. Current catalog
requirements are not historical version compatibility or proof of installation.
Acquisition and file delivery continue through the reviewed cart and secure
per-file download flows; exports grant no rights and contain no artifact storage
keys, source paths, ACL names or license secrets.
