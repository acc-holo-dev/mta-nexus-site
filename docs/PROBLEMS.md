# PROBLEMS — реестр открытых проблем MTA NEXUS

### Private buyer resource collections — 2026-10-11

Migration `0067` adds personal collections, independent resource references and
immutable command receipts. Live account checks, owner-scoped reads, owner locks,
optimistic revisions, exact UUID retries and atomic audits cover create/rename,
archive/restore/add/remove. Quotas: 30 collections including archives, 200 references
and 5000 commands per collection; all list/history/candidate views use 20-row pages.
RU/EN screens add private search and JSON inspection. Lost rights preserve only the
owner's reference; resource titles/links require effective access and safe publication.
Download buttons retain existing entitlement checks and exact pinned build selection;
collections change no payments, licenses, grants, version preferences or balances.

Local focused checks and Next compile are recorded in the Agent A report. Five new
PostgreSQL fixtures cover concurrent retries/revisions, revoked access, guard
constraints and rollback on audit failure. Actual migration/locking/trigger acceptance,
browser interaction and the pinned Node 26 runtime remain unverified here.

### Real free-plan subscription periods — 2026-10-11

Migration `0066` allows activation only from a current published zero-price plan.
A unique active-account index, account/request locks, live financial authority,
immutable database-generated terms/time and atomic operation receipts/audits
protect personal and organization periods. Expiry uses database time on reads;
a new activation retires an expired stored row under the same account lock.
Existing periods retain their terms after plan changes/withdrawal. Cancellation
ends benefits immediately and never extends or rewrites the recorded term.
RU/EN controls, scoped history, private JSON and a current-rate fee estimator are
connected to real account subscriptions. Benefits currently supply the estimator's
commission context; no settled fees, profile privileges, payments, balances,
holds, resource licenses or entitlements are changed. Paid activation and automatic
renewal remain unavailable. Six disposable PostgreSQL fixtures are prepared but
unrun here; live migration/locking, browser and Node 26 checks remain outstanding.

### Related discussion reports and team archive recovery — 2026-10-11

Staff report details now link to the private publication/discussion, including
removed targets with retained report-creation context. A comment's reports screen
provides twenty-row keyset search by reason, category and pending/history view,
with microsecond cursors bound to actor, publication, comment and filters. Removed
comment access requires retained same-publication removal proof. Removing through
a report reuses the discussion transaction: publication/comment/live-role/report
locks precede deletion, both audits and the preference-aware author notification.
Replies remain intact; other reports require separate decisions. Full-text SHA-256
protects bounded Unicode previews; old untruncated tokens remain compatible.

Organization owners/current admins can inspect shared publication history and
restore another author's current, proven team archive to a private draft. New
organization archives record an exact revision proof in existing audit events;
moderator archives, legacy unproven archives, foreign organization, server-bound
and commercial publication records cannot be restored in that desk. Restoration
preserves original authorship/text/counts and atomically records its audit and
publication notice. Current rights and version are rechecked under locks. RU/EN
screens expose safe team identity while hiding moderator identity and raw audits.

Focused validation passes 389 unit tests across thirty files, application TypeScript
including generated Next.js route types, and the Next.js compile build. Root
TypeScript still reports the existing missing `isSigned` in the commercial
resource-delivery fixture; unused analysis retains three existing commercial
exports. No schema or migration changes are included. Contract for Agent A's migration:
`CREATE INDEX reports_comment_target_created_id_idx ON reports
(target_id, created_at DESC, id DESC) WHERE target_type = 'comment';`
Without this index, a large report archive can require a scan despite bounded
results. Six PostgreSQL fixtures cover restoration races/proof/revocation,
mandatory-audit rollback, report/removal/notification atomicity, Unicode previews
and exact cursor ties; they remain unrun without a disposable database. Browser
interaction and live PostgreSQL locking/query-plan validation remain outstanding.

### Independent draft copies — 2026-10-11

Migration `0065` records immutable provenance for future free-resource copies.
The transaction holds live source/publisher/actor grants, compares reviewed
metadata, preserves author/organization and resets publication/trust/economics.
Request retries return the original receipt only while both resources remain
manageable. New targets require their own files, scanning and moderation.
Source-wide locks bound creation to 50 receipts; target/receipt/two audits commit
atomically. RU/EN forms, bounded 7/30/90/365-day history, private recorded details
and JSON exports reuse authentication, rate limits and response confirmation.
Five prepared PostgreSQL fixtures cover retry races, immutability, stale reviews,
revoked organization grants, audit rollback and global slug conflicts; they remain
unrun without a disposable database. Live migration/locking, browser interactions
and Node 26 validation remain outstanding. This feature creates no payment,
license, entitlement or subscription and does not copy artifact approval.

### Saved plan selection and version comparison — 2026-10-11

Migration `0064` records future personal/organization plan reviews with immutable
published terms, an illustrative fee calculation and an atomic audit. Exact
request retries return the old review after plan withdrawal; changed requests or
new stale selections fail. Existing financial authority checks restrict shared
organization reviews to current owners/admins. Account limits and advisory locks
bound record creation. RU/EN catalog links, selection forms, 7/30/90/365-day
history, twenty-record pagination, private version comparisons and bounded JSON
exports reuse existing authentication and rate limits. Uncertain client results
retry the same frozen selection and require exact response confirmation.

Saved reviews are not subscriptions, guaranteed price reservations or verified
payment quotes. They apply no commission benefit, hold, payout, resource license
or access grant. Monthly one-server licensing remains separate from plan durations.
Prepared PostgreSQL fixtures cover concurrent retries, snapshot immutability,
plan changes, lost organization authority and audit rollback; a disposable
database is required and those fixtures remain unrun here. Live PostgreSQL
migration/locking, browser interaction and Node 26 checks remain outstanding.
Provider settlement and actual subscription activation remain future work.

### Recorded order terms and historical seller attribution — 2026-10-11

Migration `0063` records new line terms under stable product/order locks and
protects snapshots, line economics and parent economics from later edits.
Historical rows are deliberately not backfilled. Pending creation validates
catalog prices, safe releases, currency and exact integer sums; an advisory lock
serializes request retries, mismatched retries fail, and the creation audit is
atomic. The obsolete unaudited status primitive refuses financial transitions.
Buyer/admin RU/EN terms screens and bounded JSON exports show frozen titles,
seller identity, declared license model and baseline 10%/seven-day hold alongside
separate per-currency integrity observations. Live buyer/admin authority is
checked; moderators receive no additional order access. Seller reports offer a
recorded-at-insertion mode that excludes legacy lines and preserves original
seller/title after catalog changes. Global dictionaries and Actions are untouched.

Snapshots confirm neither payment nor applied fees, refund amounts, available
balances, license issuance or file delivery. Paid provider settlement remains
closed. Local TypeScript, focused domain/repository/API/SSR regressions and upgrade
contracts cover these changes. Six prepared disposable PostgreSQL fixtures cover
immutability, authority, stale repeatable-read economics writes, concurrent exact
retries and audit rollback; they remain unrun here. Live migration/locking/query
plans, browser interactions and Node 26 verification remain outstanding.


### Seller portfolio reports and organizational sales access — 2026-10-11

Private RU/EN `/workspace/sales/report` now supports personal and organization
portfolios, product/currency/order/evidence filters and 7/30/90/365-day windows.
Bounded line details, displayed-page CSV, distinct-order counts, exact integer
per-currency values and UTC period summaries reuse the existing orders/payments.
One repeatable-read transaction checks live user and organization owner/admin
rights; product management and global moderation alone grant no financial access.
Payment attempts are aggregated before line totals, multiple/mismatched captures
require review, and unsupported currencies retain counts without mixed sums.
No buyer identity, provider transaction/failure details or unrelated order lines
are projected. Private APIs use existing auth/rate limits and no-store; exports
neutralize spreadsheet/control input. Migration `0062` adds two scoped indexes,
with no historical backfill or financial, license, subscription or grant writes.

The default is a current-portfolio observation. Earlier seller ownership/titles
were not frozen; migration `0063` adds a separate future-only recorded mode. Capture,
refund and dispute labels describe database records, not external confirmation.
Gross line values cannot prove refunded amounts, commission, net proceeds, holds
or available payouts. Paid provider settlement remains future work. Local
TypeScript, focused API/SQL/SSR regressions,
upgrade contracts and webpack compile checks cover these surfaces. Four prepared
PostgreSQL fixtures require a disposable migrated database and remain unrun;
live migration/query plans/locking, browser interactions and Node 26 verification
remain outstanding. Actions and global dictionaries were not changed.


### Transitive resource preparation and private compatibility reports — 2026-10-11

Buyer `/workspace/library/[id]/requirements`, publisher and moderator requirement
screens now inspect a bounded graph of current catalog dependency declarations.
The repository uses one repeatable-read transaction, existing live management /
moderation authority and effective library grants. Public dependencies require a
published free product with a trusted safe build; private/unavailable nodes expose
only previously declared slugs, never their title, ID or further declarations.
Up to 48 resources and eight levels are inspected; incomplete graphs and cycles
block a complete ordering. Buyer selections retain fixed-version semantics and
never silently fall back to latest. Exact private preview builds cannot cross products.

RU/EN reports compare declared minimum MTA versions, retain unknown build precision,
show exact selected hashes, package-review uncertainty, missing access and size.
Missing dependencies can be added through the existing reviewed cart; acquired safe
builds use the existing download component and its independent entitlement/artifact
checks. Advisory catalog order is not an executable MTA startup script. Read-only
private rate-limited JSON exports preserve the report snapshot and contain no
storage keys, source paths, ACL declarations or license/runtime secrets. No rights,
installation facts, payments, subscriptions or license terms are issued or changed.

Local domain/API/SSR/regression, TypeScript, lint and webpack compile checks cover
the new surfaces. Disposable PostgreSQL fixtures cover actual graph projections,
private-node masking, authority, pinned release withdrawal and exact private builds;
those fixtures require a migrated database and are not run in this environment.
Live PostgreSQL snapshots/locking, browser cart/download interactions and Node 26
remain unverified. Declared requirements cannot prove MTA execution or dependency
compatibility across resource versions; runtime installation verification and version
ranges remain separate future work.


### Storage inventory and guarded orphan cleanup — 2026-10-11

Migration `0061_storage_maintenance` adds a private observation journal and
permanent retirement barriers. RU/EN `/admin/storage` discovers bounded local
upload windows, shows age/reference eligibility and confirmed deleted bytes,
and provides per-object cleanup with explicit confirmation and revision checks.
Live admin authority, references from all build/gallery/assets states, seven-day
storage age, advisory-lock coordination, audit and retry leases are checked.
Late inserts cannot attach retired keys. Observations never backfill old purchases
or grant rights. No financial/license state, provider upload flow or Actions changed.

The local adapter checks actual bytes and descriptor identity, refuses symlinks
and hardlinks, preserves changed artifacts and resumes exact staged objects after
an interrupted rename. Discovery skips temporary/unknown names, caps directory
entries and hash bytes, and must be rescanned if directory membership changes.
Missing files do not count as successful deletion. Retired keys never return to
service; changed staged artifacts require separate manual operator recovery.

Local verification covers filesystem replacement/cancellation/retry, service
ordering, strict private API requests, RU/EN screens, upgrade contracts and
TypeScript. PostgreSQL retirement/race/audit fixtures are supplied but require a
disposable migrated database; live browser/operator storage and Node 26 checks
remain unverified here. Cloud-provider conditional deletion and automatic
inventory scheduling remain future work, with no automatic deletion enabled.


### Resource gallery, scanned canonical previews and renewed moderation — 2026-10-11

Migration `0060` introduces up to eight publisher-scoped immutable image artifacts,
deferred unique positions for atomic swaps and parent-first gallery guards. New
uploads, ordering, captions and removal withdraw publication and pending build
observations. Existing external preview values are not backfilled or changed until
editing. Gallery commands use observed product revisions and commit audit together;
private publisher history includes localized gallery actions. No access grants,
financial, license or subscription states are changed.

RU/EN author editing, first-image cover selection, read-only staff review and
marketplace galleries use current management/moderation grants. PNG/JPEG/WebP inputs
are bounded to 5 MiB, 4096 per dimension and 16 million pixels, fully decoded and
converted to static PNG within 1920 per dimension / 4 MiB, with source metadata
stripped and two concurrent conversions. Animated/unsupported inputs are refused;
the existing scanner must approve canonical output before immutable private storage.
Public image reads require a published free resource with a genuinely clean build;
private reads use live author/organization/staff authority. Full length/hash checks,
four-read concurrency, timeout, cancellation, nosniff and private no-store prevent
unverified bytes or cached withdrawn images from being served by the endpoint.
Original image bytes are never stored. Removed references, failed cleanup and
uncertain DB commits retain private objects; bounded administrator cleanup is now available (see storage maintenance below).

102 focused decoder/SQL/HTTP/service/SSR/regression checks, 25 local migration
contract checks, TypeScript, touched-source Biome lint and Next.js webpack compile
mode pass. Four PostgreSQL fixtures are prepared for deferred cover swaps,
publication withdrawal, live rights, audit rollback, immutable identity, concurrent
revision conflicts and removed IDs, but remain unrun without PostgreSQL. Browser
editing, live migration/locking, scanner/storage and pinned Node 26 verification
remain outstanding. Workflows were not used or changed.


### Bounded package inspection and private file comparisons — 2026-10-11

Migration `0059` adds nullable, immutable package evidence with exact artifact
hash/size and bounded JSON guards. Earlier builds retain unknown evidence.
The upload route checks stored/deflated ZIP headers, descriptors, duplicate/link
and unsafe paths, every entry CRC and bounded inflation before malware scanning.
Two active ZIP inspections per application process limit decompression concurrency;
busy requests fail before persistence and may retry. Storage identity is checked
again before the existing atomic build/audit path, including exact-upload retries.
The private report has a pre-storage byte budget. The imported Date serializer
keeps numeric PostgreSQL OIDs consistent with its driver types.
RAR/7z/Lua are explicitly structurally uninspected and still follow scanner gates.

Recorded per-file SHA-256 enables private version comparison and JSON export.
RU/EN author/staff screens, bounded filters, pagination and authenticated APIs hold
live personal/organization/moderator authority. Baselines cannot cross products;
missing earlier inventories produce no invented delta. Public release history
projects aggregate counts without internal paths, ACL names or raw manifest text.
Existing bounded best-effort `meta.xml` inspection reports declaration/reference
notes, not XML validity, resource execution, malware absence or source protection.
No payment, grant, license or subscription state changes in this block.

175 focused package/SQL/HTTP/SSR/upload/lifecycle checks and 24 local migration
contract checks pass. TypeScript, touched-source Biome and Next.js webpack compile
mode pass. Four disposable
PostgreSQL fixtures cover actual inventories/deltas, immutable byte evidence,
revoked authority, historical uncertainty and audit rollback; they remain unrun.
Live PostgreSQL migration/locking, browser interaction, scanner/storage integration,
MTA execution and the pinned Node 26 runtime still need verification. Paid provider
settlement, monthly issuance/renewal, subscriptions and enforced DRM remain open.
Workflows were not used or changed.


### Reviewed free-cart acquisitions and immutable buyer receipts — 2026-10-11

Migration `0058` adds nullable review evidence, a private time index and an
immutable receipt guard, without backfilling earlier version facts. The cart now
requires a separate preview of approved builds, hashes/sizes and declared MTA
requirements. Its digest detects changes and grants no authority. Stable parent,
account and exact-build locks precede a repeated review and the existing grant
path. Grants, provenance, audit, cart cleanup and receipt commit together. Request
keys bind the exact selection/review; confirmed retries survive a cleared cart.
Existing finite licenses retain their source and recorded expiry.

RU/EN receipt archive/detail pages, authenticated rate-limited APIs, 7/30/90/365-day
and evidence filters and bounded-page CSV distinguish earlier missing evidence.
Frozen public snapshots survive resource removal, without reading current private
titles. Exact-version retry independently checks current grants and artifact
identity, then uses the existing secure delivery route. The client preserves an
uncertain request, blocks cart changes until confirmation and cancels stale reads
on unmount. Receipts confirm free library operations, not payments or file delivery;
requirements remain author declarations and download pins are unchanged.

77 focused unit/query/HTTP/SSR checks, TypeScript, touched-file Biome and 23 local
migration-contract checks pass. Next webpack compile mode passes. Four prepared
PostgreSQL fixtures cover concurrent retries, stale approved-version review,
immutable evidence, resource/account deletion and audit rollback; they remain
unrun without PostgreSQL. Browser interaction, live migration/locking and the
pinned Node 26 runtime still require verification. Paid settlement, paid monthly
issuance/renewal, subscription activation and enforced MTA DRM remain unfinished.
Workflows were not used or modified.

### Private delivery evidence and publisher version totals — 2026-10-11

Migration `0056` adds immutable receipt identity and a single terminal transition,
with account-deletion cascade, bounded indexes and no historical backfill. The
live download authorization transaction creates the receipt and start audit
together. The response stream checks emitted length/hash, handles cancellation
and storage errors, and persists terminal evidence with audit through idempotent
CAS. Result-write failure preserves uncertainty; server completion does not prove
browser saving. Existing access, publication and scanner checks remain mandatory.

RU/EN buyer history, exact-version retry, individual receipt and displayed-page
CSV use account-scoped projections. Unavailable resources expose no current
editorial metadata or retry. Publisher version totals support 7/30/90/365 days
and require current personal/organization authority, with no buyer identities.
Four disposable PostgreSQL fixtures cover atomic rollback, concurrent terminal
results, immutable evidence and withdrawn/deleted resources; they remain unrun.
TypeScript, 156 focused stream/SQL/HTTP/SSR/client checks, 21 migration-contract
checks, Biome on 35 changed source files and Next.js compile mode pass locally.
Live migration/locking, browser behavior and the pinned Node 26 runtime require
verification. Paid settlement, monthly licensing, subscriptions and MTA DRM
remain unfinished.

### Resource editorial review and publisher inventory — 2026-10-11

Migration `0055` protects future editorial changes: titles, descriptions, tags and
requirements withdraw publication and invalidate every pending build observation.
Existing published artifacts/grants remain stored. The internal review requirement
survives rejection, retirement and quarantine restoration, and clears only on new
successful build review. State revisions advance monotonically; counter/rating
repair alone retains the existing metadata revision. Archived/suspended metadata
is read-only and HTTP editing requires the observed `If-Match` revision.

Publishers can resubmit a clean retained published archive without another upload.
Notification identity now includes the reviewed build revision, so repeated review
cycles cannot collide. The staff version screen includes the editorial evidence;
the shared admin queue links to that complete review instead of inline decisions.
RU/EN inventory filters/search/readiness/counts and bounded private event history
use current management grants and stable snapshots/projections. History does not
restore earlier text or invent missing events.

132 focused checks, TypeScript, 20 migration-contract checks, touched-file Biome
and Next.js compile mode pass locally. Four PostgreSQL fixtures cover withdrawal,
stale review, repeated resubmission, fallback and audit rollback but remain unrun.
Live migration/locking/rollback, browser interaction, Docker, full production
generation and the pinned Node 26 runtime remain unverified. Paid settlement,
monthly license issuance/renewal, subscriptions and enforced MTA DRM remain open.

### License term processing, buyer archive and operator queue — 2026-10-11

Migration `0054` adds immutable events keyed by the exact PostgreSQL term, without
historical backfill. The bounded worker locks/skips one license per transaction,
warns once within three days and records finite expiry with credential revocation,
audit and preference-aware inbox notification. Push enqueue uses a savepoint;
its failure preserves the inbox and expiry transaction. Unknown/non-finite terms,
original expiry and financial/purchase/access records remain unchanged.

DEV/production Compose includes the worker after app readiness, heartbeat/stall
health checks and signal shutdown. Standalone execution requires explicit opt-in.
RU/EN buyer filters, stable pagination and displayed-page CSV use private bounded
projections; live administrators have a read-only pending/unknown-term queue.
Runtime and file access recheck expiry independently of worker processing.

TypeScript, 71 focused SQL/HTTP/SSR/contract checks, 19 migration-contract checks,
Biome and Next.js compile mode pass locally. Both Compose YAML files parse with
the worker readiness dependency. Four PostgreSQL fixtures are prepared but unrun;
live migration/locking/rollback, worker/container lifecycle, browser interaction,
complete production generation and the pinned Node 26 runtime remain unverified.
Paid settlement, monthly issuance/renewal, subscription activation and an enforced
MTA DRM client remain unfinished; this block enables none of them.

### Same-server license recovery and exact-release runtime checks — 2026-10-11

Migration `0053` adds a nullable recorded server owner without backfilling trust.
Recovery uses observed license/endpoint revisions, the same saved server/scope,
current approved control proof and live grants. It clears all credential fields
and preserves the original finite term. Database guards retain bindings after
server deletion, reject server/identity/term changes and terminal-state revival,
and invalidate credentials on status/term changes. Historical unknown bindings
require explicit owner reconfirmation before another runtime token is issued.

RU/EN owner controls include an exact-release probe using the transient bearer;
the runtime API checks product/build/hash, echoes the request nonce and returns
a lease of at most 60 seconds. Private buyer/staff history is paginated by 20.
This validates saved context and a recorded hash, without authenticating the
physical caller, inspecting installed files or implementing source-code DRM.

Local TypeScript, 54 focused SQL/HTTP/SSR/contract checks and 18 migration-contract
checks pass. Four PostgreSQL fixtures cover concurrent recovery, state/identity
guards, server deletion and audit rollback but remain unrun. Live migration,
locking/rollback, browser interaction and complete production generation remain
unverified. Paid issuance/renewal, provider settlement and an enforced MTA client
are still required; no paid or subscription activation is enabled here.

### Order-linked commercial support and refund/dispute intake — 2026-10-11

Migration `0052` adds one persistent commercial case per order, immutable intake
context and shared-support association guards. Buyer and staff RU/EN pages/APIs
include bounded filters/history, safe recorded-payment snapshots, exact intake
replay and revision/evidence-checked review. Current staff authority and independent
review are enforced in the transaction; refund recommendations/declines require
an administrator. Messages, audit, shared status and requester inbox notification
are atomic. Recommendations keep the conversation open and execute no finances.

Local TypeScript, 149 focused checks, 17 migration-contract checks, Biome and
Next.js compile mode pass. Five PostgreSQL fixtures are prepared but unrun;
live migration/concurrency/rollback, browser interaction and complete production
generation remain unverified. Paid-provider settlement, financial refunds,
fee/hold allocations, payout eligibility and subscription activation remain open.

### Resource review lifecycle and commercial report queue — 2026-10-11

Reviews now publish/edit/withdraw with locked live publisher and acquired-access
checks, finite-license expiry rechecks and optimistic revisions. Rating repair is
transactional and preserves the publisher's metadata revision. Public projections
exclude account IDs and old purchase flags; legacy acquisition is explicitly
unreverified. Private author history remains available after access expiry.
Commercial review reports have separate private/staff pages, replay deduplication,
current-role checks and exact review evidence for removal; the generic resolver
cannot bypass this contract. Removed reviews cannot be republished by their author.

Migration `0050` preserves historical text/rating/source uncertainty and adds review
state/revision/source fields, bounded-list indexes and Agent B's requester-history
index. The migration journal and upgrade target include `0050`; local upgrade
contract checks pass, while the PostgreSQL rehearsal itself is unrun. New lifecycle
and updated aggregation fixtures cover concurrency, live role revocation, expiry,
rollback and private scope, but require PostgreSQL. Browser interaction and complete
production generation remain unverified. Paid-provider, refunds, payout eligibility
and subscription activation remain separate unfinished work; paid checkout is disabled.

### Financial statements and journal foundation — 2026-10-11

Migration `0049_financial_journal` adds idempotent batches and immutable balanced
journal entries with deferred per-currency validation. PostgreSQL calculates new
balances and prevents extending a committed journal. Historical entries remain
distinct and are not promoted into verified settlement. Personal/organization
statements and live-admin reconciliation are read-only; held/available amounts
remain explicitly unreconciled. Generic payment methods cannot create completed
attempts or promote recorded attempts to financial final states without a provider.
Local domain, repository SQL, HTTP, SSR, type and compile checks cover the paths;
live PostgreSQL deferred-trigger/locking/rollback checks and browser acceptance
remain pending. A rollback-only PostgreSQL fixture is prepared. Provider integration,
automatic fee/hold allocation, payout eligibility and subscription activation are
still required before enabling paid commerce.

### Resource restrictions and saved download versions — 2026-10-10

Migration `0048_resource_release_controls` stores private buyer version preferences
and indexes the resource moderation queue. Moderation release now returns to draft
for review, including the legacy administrative route; it cannot directly restore
publication. Staff decisions and publisher-visible history use live locked authority,
revision checks and atomic audit. Fixed downloads fail closed on withdrawal, and
preferences do not modify grants, licenses or financial records. Local contract,
SQL, HTTP and SSR checks cover these paths. Live PostgreSQL migration/rollback/
concurrency and browser acceptance remain pending; the corresponding PostgreSQL
fixtures are updated. Paid provider confirmation and subscription activation remain
unfinished separate work.

### Acquisition provenance and publisher activity — 2026-10-10

Migration `0043_resource_acquisition_activity` records new direct/cart free
grants in the entitlement transaction. Buyer history masks withdrawn metadata;
publisher activity and CSV expose only aggregate free grants and download
starts, with live personal/organization authority and UTC periods. Existing
licenses are preserved by the shared claim path rather than converted into
permanent grants. Customer file delivery rechecks rights and exact artifact
evidence after storage opens and closes the stream on denial. Personal sales
history no longer includes organization resources merely authored by the user.
Live PostgreSQL migration/concurrency and browser acceptance remain pending;
paid checkout, financial balances and renewal are not enabled by this block.

### Resource variants and requirements — 2026-10-10

Migration `0041_resource_variants` adds bounded catalog groups, unique resource
membership/labels/positions and revision checks. Authors and organization product
managers can order related free resources, rename variants and remove links with
transactional audit. Each resource retains independent releases and access;
this is catalog grouping, not paid SKU checkout or source/DRM delivery modes.
Public choices require a published safe anchor and individually safe variants.
Requirements editing preserves build metadata, rejects self-dependencies and
uses live authority plus product revision checks; existing metadata edits now
hold those grants through commit. Migration `0042_content_discussion_lookup`
implements Agent B's content/time/ID pagination index contract. Reviewer delivery rechecks
current role and exact evidence after storage opens, before streaming bytes.
PostgreSQL migration/rollback/concurrent execution and browser acceptance remain
unverified. Paid provider confirmation, SKU purchase, monthly issuance and
financial holds remain separate unfinished work.

Единственный реестр проблем проекта. Обновлён: 2026-10-10 (после закрытой истории серверов и проверки объединённого main; текущий hosted-runner blocker зафиксирован ниже).

Правила реестра:

- каждая проблема имеет приоритет, описание, доказательство и следующий шаг;
- закрытая проблема удаляется из реестра в том же коммите, который её закрыл
  (история — в commit messages и CI evidence);
- проблемы не дублируются в других документах; OPERATIONS ссылается сюда.

Приоритеты: `P0` — блокер релиза, `P1` — существенная проблема качества,
`P2` — известное ограничение, требующее работы, `P3` — улучшение/гигиена.

---

## P0 — блокеры релиза

На `a7d6080` успешно завершились CI, Account browser,
Directory browser и Resource browser. Подтверждены production/local Docker,
PostgreSQL persistence, восстановление бэкапа, полный Verify и production mail
worker (TLS, аварийный перезапуск, штатное завершение и отказ без ключа).
Это проверка одноразового CI-стека, а не существующей production-инфраструктуры.
Обязательные status checks пока не настроены.

## P1 — существенные проблемы

### P1-1. Приёмка на целевой инфраструктуре

CI переработан: один workflow-координатор, отдельные параллельные unit и
последовательные database проекты, один кешируемый production-образ на SHA.
Быстрый контур включает оба тестовых проекта и короткий браузерный smoke;
полная приёмка запускается явно/по релизному тегу/при изменении инфраструктуры.
Пропущенный обязательный шаг не считается успешной приёмкой. Полный новый
контур успешно прошёл на `fde2721`: 930 unit и 203 database проверки, 109
Node-проверок, production/local Compose, SMTP worker и все браузерные сценарии.
На том SHA все 239 существовавших Vitest-файлов были распределены без пропусков и пересечений; текущий классификатор проверяет полный автоматически обнаруженный набор. Быстрый контур
подтверждён на `7a9539e`: оба тестовых проекта, tooling и production browser smoke
зелёные; тяжёлые инфраструктурные и полные браузерные задания пропущены.
В этом прогоне обнаружена и исправлена first-use гонка recovery rate-limit:
параллельные запросы теперь сериализуются по keyed digest до чтения окна. Production-образ
собирается один раз; обычное изменение приложения требует шесть заданий вместо
прежних девяти. Локально unit проходят за ~12 секунд; на GitHub их время зависит
от runner. На `c06da2e` `biome lint --max-diagnostics=200 .` и `tsc -b`
прошли без lint-диагностик; unit/tooling, sequential database tests,
exact-SHA production image и production browser smoke также зелёные.
Флейк recovery-теста account-mail worker устранён корректным IPC handoff с
ожиданием callback отправки lease, а не увеличением таймаута.
Локально PostgreSQL и Docker недоступны; интеграционные результаты берутся из CI.

Живая приёмка больших портфолио закрыта: Chromium проверяет разработчика,
пользователя и организацию с 125 безопасными ресурсами и 25 статьями,
RU/EN, ширины 390/1280 px, страницы за первыми 100 ресурсами, одинаковые
даты, устаревшие ссылки, исключение чужих/черновых/платных/небезопасных
записей и независимость resource/article пагинации. Сохранены скриншоты.
Полный Verify вызывает настоящие репозитории на временных таблицах с
10 128 ресурсами и 10 025 статьями, проверяет выбранные индексы и сохраняет
EXPLAIN ANALYZE/BUFFERS до и после миграции 0026.

**Следующий шаг:** проверить планы запросов, память/диск и критические сценарии
на восстановленной копии целевой БД. Синтетический CI-набор и Chromium не
подтверждают production-нагрузку или совместимость остальных браузеров.


### P1-2. GitHub-hosted runner не начинает `plan` job

Добавлен приватный список управления серверами с пагинацией, поиском,
фильтрами и организационными полномочиями. Обзор запрашивает четыре карточки
и точный total, вместо полной выборки owner-строк. Live-метрики относятся к
показанным карточкам; неизвестные counts не превращаются в нули. SQL-builder
и SSR проверки дополнены PostgreSQL fixture на 135 доступных серверах и
исключённых организационных правах. Её реальное исполнение, планы запросов
и браузерная приёмка остаются открытыми; новая миграция не требуется.
После совмещения с архивом версий ресурсов локальный `pnpm check:code`
прошёл 1658 unit и 201 tooling проверку, typecheck, Knip и архитектурный
анализ. Lint сохранил 40 предупреждений. Удалены два неиспользуемых
реэкспорта release-pagination helpers из web-модуля; прямые domain API сохранены.

История серверов теперь агрегирует весь выбранный период 24h/7d/30d, а не
только последние 500 записей. Сводка и UTC-интервалы графика читаются вместе с
ограниченными подробными записями в read-only repeatable-read транзакции.
Это исправляет пропущенные старые пики и неполные счётчики; три SELECT добавляют
работу БД, production latency ещё не измерена. Пропуски не считаются offline.
SQL-builder, HTTP, сервисные и SSR проверки дополнены PostgreSQL fixture с
более чем 500 наблюдениями; её реальная DB приёмка остаётся открытой.
После совмещения с библиотекой ресурсов и миграцией 0036 прошёл полный
`pnpm check:code`: 1591 unit и 200 tooling проверок, typecheck, Knip и
архитектурная проверка. Lint сохранил 40 предупреждений. Устранена случайная
ошибка VAPID fixtures: тестовые scalar keys дополнены до 32 байт без изменения
рабочей криптографии. Эти результаты не заменяют PostgreSQL/browser приёмку.

Подготовлен единый credential-free SQL projection для пользователей и
узкий session identity lookup: account/profile/context запросы не читают
password_hash, identity не читает private session metadata. Legacy lookup и
password revalidation под lock сохранены. Некорректный/non-finite expiry
отклоняется. SQL-builder и row-mapper проверки не заменяют PostgreSQL/browser
приёмку; она остаётся заблокирована hosted runner.
Срез совмещён с параллельными изменениями read-only commerce history и правкой
landmark accessibility. Восстановлены актуальный anonymous-page контракт,
типобезопасный currency formatter и проверки неиспользуемого кода.
Локально прошли 1534 unit и 200 tooling проверок; реальная DB приёмка остаётся открытой.

Последний проверенный CI для `d4be469` (run `37914732835`) снова завершился
до выполнения шагов: `plan` failure, steps=0, runner_id=0; DB job skipped.
Причина отказа hosted runner по доступным данным не установлена.
Проверка ресурсных прав теперь читает ID вместо полной entitlement-строки,
permissions вместо полной лицензии, а claim preflight — только status/price.
Drizzle/pg-proxy покрывает прежние фильтры доступа и последовательность claim;
настоящая PostgreSQL-приёмка остаётся открытой до восстановления CI.
Локальный срез прошёл 1488 unit и 200 tooling проверок, typecheck, Knip
и архитектурный анализ; lint сохранил 40 предупреждений.

Страница Security и HTTP API сессий/Web Push больше не читают одну
session/user запись дважды для пользователя и ID текущей сессии.
`getSessionIdentity` возвращает их из одного validated lookup без кеша между
запросами. Проверки текущего actor под блокировкой при отзыве сессий сохранены.
Drizzle/pg-proxy, HTTP и SSR проверки покрывают expiry, missing/revoked rows,
приватность и ранний отказ Web Push; настоящая DB/browser приёмка остаётся открытой.
Локальный `pnpm check:code` на этом срезе прошёл 1452 unit и 200 tooling
проверок, typecheck, Knip и архитектурный анализ; lint сохранил 40 предупреждений.

На saved-странице чтение ресурсов больше не задерживает MTA lookup после
получения публичных серверов. Проверки подписки и отметки уведомления возвращают
только ID вместо полной строки. SSR virtual-clock и Drizzle/pg-proxy тесты
проверяют порядок операций, фильтрацию, fallback, SQL и boolean-результаты;
реальная production-задержка и PostgreSQL execution этими тестами не измерены.
Этот срез локально прошёл `pnpm check:code`: 1440 unit и 188 tooling проверок,
typecheck, Knip и архитектурный анализ; lint сохранил 40 предупреждений.

Счётчик просмотров статьи теперь увеличивается в SQL и получает значение
через RETURNING. Рассылка уведомлений ограничена десятью операциями на вызов,
считает результаты по партиям и продолжает обработку после синхронных и
асинхронных ошибок отдельных получателей. Локальные проверки этих изменений
используют моки; конкуренция настоящего PostgreSQL и нагрузка нескольких
одновременных рассылок ещё требуют отдельной приёмки. Подробности и команда
проверки описаны в OPERATIONS, раздел Code analysis.

После совмещения с новыми коммитами устранены локальные ошибки типов и устаревшие
тестовые контракты history/cache/session. Upgrade rehearsal обновлён до 0034:
добавлены существующий сервер и legacy challenge, проверки revision defaults
и constraints. Его реальное исполнение на PostgreSQL ещё не подтверждено.
Совмещённое дерево локально прошло `pnpm check:code`: 1434 unit и 188 tooling
проверок, typecheck, Knip и архитектурный анализ. Lint завершился с 40
предупреждениями; это не чистый lint и не hosted CI/PostgreSQL-приёмка.

2026-10-09: наблюдения старых endpoint больше не сохраняются в
историю нового IP/порта, включая случай A -> B -> A. При записи collector
сравнивает исходный адрес и `endpointRevision` под `SELECT FOR UPDATE`
до INSERT и возвращает null при несоответствии;
диагностика считает `recordSkippedEndpointChanges`. Механизм усиливает
согласованность истории и live-данных, но добавляет один locking SELECT
на наблюдение; реальный PostgreSQL throughput/latency и race acceptance
нужно проверить после восстановления CI.



2026-10-09: оптимизирован bounded collector: добавлен постраничный
keyset-обход по id, CLI `NEXUS_SERVER_OBSERVATION_MAX_PAGES` и
`NEXUS_SERVER_OBSERVATION_AFTER_ID`, выходной `nextCursor`.
Для многостраничного CLI пишется безопасный checkpoint на stderr после
каждой полностью завершённой страницы; при сбое следующей страницы
оператор может продолжить без потери известного прогресса.
Теперь можно продолжить после первых 500 серверов без перезапуска
обхода с начала. Фиксированное число страниц ограничивает нагрузку.
Стабильность выборки между отдельными запусками при параллельных
изменениях требует отдельной приёмки; текущий CI блокер остаётся.



2026-10-09: добавлена защита MTA claim proof через `endpointRevision`
и миграцию 0034: issue/consume/moderation проверяют ревизию
сетевого адреса, при смене IP/порта сбрасывается `isVerified`.
Редакционные правки не сбрасывают подтверждение. Старые proof с NULL
revision не принимаются; до перевыпуска нужно отклонить старый pending.
PostgreSQL CI и миграционная приёмка остаются обязательными.



2026-10-09: исправлены конкурентные операции при изменении IP/порта
серверной карточки. Условный PostgreSQL UPDATE сбрасывает старые
live-метрики при изменении endpoint, а запись наблюдений проверяет
endpoint, который был считан сборщиком. Тесты PostgreSQL добавлены,
полное выполнение заблокировано отсутствием hosted runner.



Доступные методы истории наблюдений `listRecent`, `listWindow` и
`getPeakPlayers` теперь устойчивы к NaN/Infinity: лимиты и интервалы
получают безопасные значения по умолчанию до построения SQL. Прежние
числовые ограничения сохраняются; добавлены контрактные проверки граничных
значений и дат. Их выполнение в текущем CI ещё не подтверждено.

MTA master-list fetch отказывается от редиректов (`redirect: "error"`) и
отсекает `response.redirected` даже при injected HTTP adapter. Так mirror
не может перенаправить доверенный HTTPS endpoint на иной адрес или протокол
через штатный Fetch redirect. Добавлены два теста fallback/error semantics.
В PostgreSQL-выборках истории серверов tie-breaker по ID делает выдачу
детерминированной при одинаковом `observed_at`. Дополнительные SQL unit
tests проверяют сортировку, предел 500 и последовательность результатов.
До полноценного CI/PostgreSQL их прохождение не подтверждено.


API каталога MTA без фильтров читает только нужную страницу; при фильтрации
считает все совпадения, сохраняя только страницу до 100 ссылок на серверы.
Fixture из 10 000 серверов показала 50 чтений вместо 10 000 для страницы
из 50 записей. Последующие текстовые запросы по одному неизменяемому снимку
каталога повторно используют нормализованные строки через WeakMap; на новую
версию снимка создаётся отдельный ленивый индекс, который может быть собран GC.
Фильтр только по числу игроков и выдача без фильтра индекс не создают.
При stale fallback каталог теперь выставляет HTTP `Cache-Control: no-store`,
чтобы публичный SWR-кеш не продлевал срок устаревшего master-list.
ASE reader также использует один UTF-8 декодер на снимок вместо декодера
для каждого поля. Регрессионные тесты добавлены; точное измерение
production latency и память под нагрузкой всё ещё требуют внешней приёмки. Вкладка серверов `/discover` использует общий endpoint index
для нескольких карточек: 12 отсутствующих результатов требуют 10 000 чтений
адресов вместо 120 000. Сохранены Unicode/joined-field поиск, точные totals,
порядок, первые дубли, раннее одиночное совпадение и stale/failure отображение.
Общий endpoint index строится постепенно, сохраняя просмотренную часть:
двенадцать ранних совпадений требуют только двенадцати чтений. Остальные
потребители helper также получают это поведение без изменения API; снимок
не должен изменяться во время использования lookup. Новые проверки включают
2000 generated comparisons пагинации на двух seeds, 1000 сравнений index
с первым `Array.find` и SSR настоящих карточек с synthetic service adapters.
Локальный `check:code` прошёл 1328 unit, 178 tooling, typecheck, lint, Knip
и архитектурную проверку.
Production latency/heap и живая browser приёмка этими проверками не подтверждены.

Страница деталей MTA-сервера теперь передаёт уже загруженную запись в
`serverHistoryService.getHistoryForServer` и не дублирует lookup по ID
перед выборкой истории. Вариант `getHistory(id, window)` для публичного
history API сохранён, оба пути проверяют private visibility. Добавлены
три unit behavior cases с repository mock. Это уменьшение на один SELECT
при SSR страницы с историей, не измерение полной задержки страницы.

Запись наблюдений теперь обновляет агрегированные live-поля сервера только
если время нового наблюдения строго больше сохранённого (или прежней отметки
нет). Старая или одновременная по timestamp запись остаётся в истории, но
не затирает более свежие currentPlayers/maxPlayers/source. Предикат выполняется
в одном PostgreSQL UPDATE после вставки с onConflictDoNothing, без
прикладного read-before-write или новой миграции. Добавлены real-DB
integration cases: older-after-newer, equal timestamp, duplicate и
конкурентная запись; до исполняемого database CI они не считаются пройденными.

Публичный `GET /api/servers` теперь читает редакционные данные и master-list
одновременно (upstream failure не ломает выдачу), а для нескольких
редакционных карточек использует инкрементальный endpoint index вместо
повторного Array.find на весь master-list. При 60 отсутствующих совпадениях
на synthetic 10k-снимке число индексных чтений сокращается с 600k до 10k
(проверяется единичным proxy instrumentation). Ответ с unavailable или
stale upstream больше не сохраняется в публичном HTTP/SWR-кеше; у
достоверно свежего upstream прежний короткий кеш сохранён. Добавлены
unit HTTP tests, а оценка production latency остаётся непроверенной.

Выборка известных серверов для MTA observation collector теперь возвращает
только id/ipAddress/port вместо полного редакционного профиля с JSON
метаданными. Выборка сохраняет фильтры active/non-private, лимит 501
(включая overflow sentinel) и стабильный порядок updatedAt DESC, id DESC.
Контракт проверяется unit-тестами построения Drizzle SQL; нагрузочный замер
PostgreSQL остаётся задачей целевой приёмки.

Сборщик наблюдений запускает два независимых чтения одновременно и сохраняет
совпадения партиями до пяти параллельных записей. При ошибке он дожидается всех
начатых операций до закрытия соединения CLI и не запускает следующие партии;
уже завершённые транзакции могут сохраниться. Существующие ограничения среды,
лимит 500 и repository transaction/duplicate semantics не изменены.
Одиннадцать новых проверок используют synthetic repositories и настоящие
endpoint helpers; fixture из 500 записей занимает 100 виртуальных тактов вместо
500 при ограничении в пять операций. Локальный `check:code` прошёл 1310 unit,
178 tooling, typecheck, lint, Knip и архитектурную проверку. Это подтверждает
порядок выполнения и завершение операций при отказе, а не реальную пропускную
способность PostgreSQL или DB/browser приёмку.

Карточка ресурса одновременно запускает независимые чтения после успешного
preview; история сборок остаётся зависимой от текущего management decision.
Locale/session и public metadata/locale также стартуют вместе. Одиннадцать
проверок acquisition/page behavior используют удерживаемые Promise и SSR с
synthetic service adapters; проверены оба решения управления, отказ прав,
поздняя ошибка entitlement и отсутствие detail reads после denied preview.
Локальный `check:code` прошёл 1299 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Это подтверждение порядка запуска и UI, а не измерение
production SQL latency или живая DB/browser приёмка.

Глобальный поиск использует общий endpoint index для нескольких серверных
результатов, сборщик наблюдений также повторно использует этот helper.
Fixture с 10 000 наблюдений и 50 отсутствующими серверами показала сокращение
чтений адресов с 500 000 до 10 000; одиночный ранний match сохраняет прямой
поиск. Все 32 целевые проверки прошли. Полный локальный `check:code` прошёл
1293 unit и 178 tooling, typecheck, lint, Knip и архитектуру. Это проверка
количества операций и поведения с synthetic sources, а не production latency,
памяти под нагрузкой или DB/browser acceptance.

Контексты аккаунта читают выбранные организации участника одним `IN` запросом
с тремя колонками вместо до 50 поштучных чтений. Сохранены owner priority,
роли, исходный порядок членств, лимит, private headers и personal fallback.
Локальный `check:code` прошёл 1289 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Десять HTTP проверок и три проверки SQL/row mapping на настоящем
Drizzle builder с proxy driver не требуют БД. Интеграционный owner/revocation
сценарий дополнен проверкой доступного membership context, но PostgreSQL
локально недоступен; выполнение этой проверки и DB latency не подтверждены.

Polling колокольчика теперь выполняет последовательные чтения и отменяет
запрос при hidden/cleanup; запоздавший ответ не перезаписывает свежий UI.
Во время mark-all-read фоновое чтение приостановлено до повторной сверки
с сервером. Применён существующий private API helper, без новых зависимостей.
Локальный `check:code` прошёл 1281 unit и 178 tooling, typecheck, lint, Knip
и архитектуру. Новые проверки используют fake timers и SSR effect adapter;
три регрессии воспроизведены до исправления. Это проверка lifecycle запросов,
а не живая DOM/browser приёмка или production замер экономии трафика.

Публичные profile/server metadata и страницы теперь разделяют одно чтение
записи в рамках RSC-запроса, locale также мемоизирован на время запроса.
Реальный RSC renderer development/production прошёл 40 synthetic renders с
параллельными RU/EN запросами, повторным запросом и missing → created.
Локальный `check:code` прошёл 1266 unit и все проверки кода; полный tooling
набор после добавления обоих RSC режимов содержит 178 успешных тестов.
Это подтверждает дедупликацию при синтетических репозиториях, а не реальные
DB-тайминги или приёмку production Docker/browser.

Локальный и CI unit-контуры теперь используют `pnpm check:code`: шесть
проверок выполняются последовательно, ошибки собираются за один запуск с
ненулевым итоговым статусом. Команда прошла локально: 1266 unit и 176 tooling,
lint, typecheck, Knip и архитектура. Ручной tokenizer тестовых импортов заменён
уже установленным SWC; семь новых fixture-проверок покрывают типы, templates,
typed mocks, computed importActual/unmock, partial mocks, CommonJS и отказ при
невалидном синтаксисе. Все 287 Vitest-файлов сохранили свои группы: 219 unit,
68 database. Эти проверки не подтверждают выполнение DB/browser/Compose.

Последующий browser-toolchain/fast-check slice объединил пять установок
браузерных инструментов в один источник версий. Реальная npm-установка профиля
`a11y` локально прошла. Также прошли 1266 unit, 169 tooling, frozen install,
typecheck, lint, Knip и архитектурная проверка. Четыре proxy/IP свойства проверены
по 1000 примеров на двух seed; найденный UTF-8 length exception воспроизведён
до исправления и устранён с регрессионной проверкой настоящих Fetch Headers.
Это самостоятельные проверки установки/защитного кода, а не выполнение
production Docker или browser acceptance.

В browser smoke и resource-browser добавлены axe-проверки WCAG для форм,
диалогов и авторизованных состояний RU/EN. Само падение gate при нарушениях и
сохранение диагностик проверяются отдельными Node-тестами с browser-adapter
fixture. Настоящий browser scan в текущей локальной среде не выполнен:
обычный Chromium не установился, альтернативный локальный binary не запускается.
До executable CI нет подтверждения axe baseline на production-образе;
найденные там нарушения нужно исправить, а не скрывать правилами/исключениями.

DEV Mailpit overlay добавлен в `Local Docker startup`: приёмка проверяет
worker health, непубликуемый SMTP, loopback UI и фактический TLS SMTP/API capture.
Локально прошли typecheck, lint, Knip, архитектурная проверка, 1261 unit,
163 tooling и 26 runtime/dispatcher тестов. Tooling включает настоящий TLS
handshake с генерируемым сертификатом и отказ при неверном hostname.
Docker в среде этой проверки недоступен; новая Compose-приёмка пока не выполнена.
Это не закрывает существующий hosted-runner blocker или production rollout.

После исправлений Web Push commit `0221f85` и все проверенные последующие
SHA получают один и тот же внешний симптом: job **Choose verification scope**
завершается `failure` до первого шага. GitHub Actions Jobs API возвращает
`steps: []`, `runner_id: 0`, пустые `runner_name` / `runner_group_name`;
job logs отсутствуют. Check Run при этом создаётся и содержит системные
annotations, то есть workflow зарегистрирован, но runner не назначается.

У run `37565630603` zero-step failure воспроизведён в трёх attempts, включая
отдельный rerun конкретного failed job. Симптом далее стабильно повторяется на
новых push-runs. Свежий run `37719493537` на `cab1c78` завершился тем же
образом: plan job `113123622340` имеет `runner_id: null` и `steps: 0`;
все executable jobs были пропущены до checkout/user code. Это подтверждает, что blocker пережил
durable Web Push queue alerting и safe public offline-cache refactor и не
привязан к конкретному workflow step. При этом последний полностью исполнившийся HEAD `7567191`
прошёл полный CI, а run `37565299572` на `3a1f818` ещё назначал runners,
запускал реальные jobs и дал обычные диагностируемые ошибки
typecheck/upgrade rehearsal.

Репозиторий private. Доступный GitHub connector не раскрывает account billing /
Actions minutes / repository Actions policy, поэтому причина (quota/billing,
repository policy или runner-side allocation failure) **не подтверждена**.
Публичный GitHub Status на момент диагностики показывал Actions operational,
так что глобальный outage также не подтверждён.

На `93604f1` run `37910773256` и plan job `113755107097` повторили failure
с пустыми steps. Check Run зарегистрировал две annotations, но текущий
connector отклоняет endpoint их чтения; job logs вернули BlobNotFound.
Точное системное сообщение поэтому ещё не прочитано. Добавлена read-only
команда `pnpm ci:diagnose --run-id 37910773256`: при локальном токене с
Actions/Checks read она собирает attempt-specific jobs и системные annotations,
не меняя settings и не перезапуская CI. Команда покрыта synthetic API tests;
live authenticated REST-запуск в этой среде не выполнен.

- **Влияние:** commits после `7567191` пока не получили executable exact-SHA
  CI, даже когда их ошибки проверены статически/математически.
- **Следующий шаг:** прочитать системные annotations через `pnpm ci:diagnose`,
  затем проверить GitHub Settings → Actions и Billing/usage для
  private repo/account; после восстановления hosted runner запустить полный CI
  на актуальном HEAD и закрыть этот пункт только после реального выполнения
  `plan`, unit/typecheck, migrations, Docker и browser acceptance.


### P1-3. Release upgrade fixture отставал от Web Push outbox

Upgrade rehearsal раньше отставал от Web Push outbox. Сейчас release contract
намеренно требует, чтобы target совпадал с последней migration journal entry.
После добавления Support idempotency target обновлён до
`0033_support_mutation_idempotency`: rehearsal проверяет Support tables,
все read-path индексы (requester, status, category+status, global staff order),
message-history index, Web Push subscriptions, outbox/gate/indexes,
rollback/retry, legacy rows и idempotency. Любая новая migration снова
заставит fixture fail-fast до review.

- **Статус:** исправлено в коде, но exact-SHA hosted CI всё ещё нужен после
  восстановления runner allocation.

### P1-4. Web Push external acceptance ещё не выполнена

Durable Web Push runtime, worker recovery, stale-subscription lease ownership, local TLS/SNI provider harness,
`Retry-After`, anti-SSRF, queue health/watchdog (включая корректный alert при ровно 100% capacity), serialized capacity gate с сохранением inbox при saturation и concurrent PostgreSQL
lease/settlement уже реализованы. Для двух оставшихся внешних доказательств
добавлены отдельные fail-closed инструменты:

- `pnpm push:soak` — fixture-only production-duration soak. Synthetic sender
  видит только собственный namespace, принудительно проходит 503→retry→201,
  проверяет exactly-once acceptance, drain, queue pressure и cleanup; artifact
  `artifacts/web-push-soak-evidence.json` имеет checksum и отдельный validator
  `pnpm push:soak:verify`;
- `pnpm push:provider:probe` — одноразовая отправка через настоящий production
  sender/VAPID/anti-SSRF к реальной browser subscription. Artifact
  `artifacts/web-push-provider-evidence.json` сохраняет только provider origin,
  SHA-256 endpoint/public-key fingerprints, HTTP status и timing; endpoint,
  p256dh/auth и private VAPID key в evidence не сериализуются. Validator:
  `pnpm push:provider:verify`.

Core `release:verify` теперь только ссылается на эти artifacts по
`present/valid/sha256` в отдельном `externalEvidence`; core
`releaseCandidate` намеренно не выдаёт их отсутствие за пройденную public
production acceptance.

- **Статус:** tooling готов, но evidence ещё не получена на staging/целевой сети.
- **Следующий шаг:** на изолированной staging-БД выполнить минимум 15-минутный
  soak с `NEXUS_WEB_PUSH_SOAK_ACK=YES`, затем live provider probe с реальной
  browser subscription и полным VAPID набором. Оба validators должны пройти;
  artifacts привязать к тому же release SHA. Не использовать production
  пользовательскую subscription/queue для synthetic soak.

### P1 — приёмка корзины и жизненного цикла ресурсов

Миграция `0039_resource_cart` добавляет приватную корзину, идемпотентные
результаты бесплатной выдачи и индекс позиций заказа. Архивирование,
восстановление черновика и повторная модерация сохраняют файлы и права;
версии не могут самостоятельно перепубликовать архивный/заблокированный
ресурс. Загрузка и отзыв версий перепроверяют актуальные полномочия под
блокировками. Состав старого заказа доступен только покупателю и не выдаёт прав.

**Следующий шаг:** выполнить миграцию и проверить rollback, конкурентные
claim/cart/moderation/archive, отзыв организационных прав и RU/EN сценарии
в браузере на локальном PostgreSQL. SQL-builder/HTTP/SSR проверки и
production-компиляция пройдены; они не заменяют эту приёмку.

### P1 — приёмка управления лицензиями

Миграция `0040_license_runtime_controls` вводит неизменяемую привязку сервера
и его ревизии, хеши токенов и предел их срока 30 дней. Исходный срок старой
лицензии не меняется. Приостановка, восстановление и отзыв очищают токены;
отозванные лицензии не восстанавливаются. API проверки требует одобренного
доказательства контроля сервера, актуальных прав и чистой опубликованной версии.
Это проверка bearer-токена, а не доказательство физического источника запроса
или универсальный DRM. Платная выдача и продление не включены.

**Следующий шаг:** проверить миграцию/rollback и гонки bind/rotate/revoke,
смену адреса, удаление сервера, отзыв членства и модерацию на PostgreSQL;
выполнить браузерную приёмку RU/EN и внешнего HTTPS-клиента. Локальные SQL,
HTTP, SSR, typecheck и compile-mode сборка не заменяют эти проверки.

## P2 — известные ограничения

### P2-1. Внешние ресурсы недоступны из сети владельца

`master.multitheftauto.com` (master-list) не отвечает даже с хоста —
похоже на региональную блокировку сети. Историческая зависимость fresh demo
seed от `images.unsplash.com`/DiceBear устранена: новый baseline не записывает
remote media URL и использует UI-fallbacks. Старые dev-тома могут адресно
очистить только точные legacy seed URL через `pnpm db:seed:repair-media`;
пользовательские replacements сохраняются. Live-серверы при недоступности
official master без настроенного mirror по-прежнему не отображаются.

- **Изменение:** master-list runtime теперь поддерживает до трёх явно заданных
  оператором HTTPS fallback endpoints через `MTA_MASTER_MIRROR_URLS`.
  Официальный `master.multitheftauto.com` всегда идёт первым; все попытки
  делят единый 10-секундный budget. Mirror обязан пройти тот же 8 MiB bound,
  ASE parser, server-count limit и EOF validation. Конфигурация отклоняет HTTP,
  credentials, IP literals, localhost/mDNS, single-label hostnames, нестандартный
  порт, дубли и больше трёх endpoints. Ошибка всех источников остаётся generic
  и не раскрывает operator endpoint клиенту.
- **Следующий шаг:** поднять/выбрать реально контролируемый mirror в целевой
  production-сети, настроить его через environment и подтвердить live refresh
  + stale fallback при недоступном official endpoint. Это изменение даёт
  безопасный механизм переключения, но само по себе не доказывает доступность
  какого-либо mirror. Для реальных пользовательских превью по-прежнему
  предпочтителен upload в контролируемое storage; fresh demo-data от внешнего
  image CDN больше не зависит.
- **Изменение:** превью ресурсов теперь скрывает недопустимые HTTP/HTTPS-адреса
  и показывает RU/EN-заглушку при ошибке декодирования или загрузки, включая
  кешированную ошибку до гидрации. Open Graph применяет ту же проверку URL.
  Browser-сценарий сломанного изображения прошёл на RU/EN в CI.

### P2-2. Dev-стек и нестандартные внешние hostname

Первоначальная проблема с Compose-hostname закрыта в CI: dev-конфигурация
разрешает стабильный service DNS `app` (и сохраняет совместимость с
`nexus-local-app-1`), а Chromium проверяет настоящий hydrated UI через
`localhost:3000` и `app:3000`. В обоих случаях theme toggle изменяет
DOM/localStorage, а login form отправляет client-side `POST /api/auth/login`
и не деградирует в нативный GET.

- **Остаётся ограничение:** произвольный LAN/IP/custom hostname намеренно не
  разрешён автоматически. Его нужно добавлять явным trusted dev origin, иначе
  Next.js dev-origin protections должны продолжать fail closed.
- **Следующий шаг:** отдельная работа нужна только если появится реальная
  потребность поддерживать конкретный LAN/custom dev hostname.

### P2-3. Скачивание: целевые устройства, браузеры и production-нагрузка

Реализованы настоящие ZIP для inventory и drift, транзакционный повторяемый
seed, проверка занятых ID/slug, сохранение пользовательских правок и явный
`db:seed:repair` для size/hash известных демосборок. Чужие файлы не заменяются;
модерационные статусы не сбрасываются. Изменённая версия/статус продукта
блокирует повторное добавление отсутствующей демосборки.

- **Проверено:** файловые и HTTP-тесты, логика транзакций с моками, типизация
  и сборка. Публичное и модераторское скачивание отклоняют известное
  несовпадение размера/хеша до аудита; исчезнувший файл возвращает 404.
- **Проверено 2026-09-30:** локальный provider хеширует открытый файл перед
  выдачей. Настоящее повреждение того же размера отклоняется обоими HTTP-
  маршрутами до аудита. Запись файлов атомарна; повторный ключ и проигравшая
  конкурентная запись не перезаписывают опубликованные байты.
- **Ограничение:** внешняя запись в тот же inode после проверки остаётся
  возможной; это не неизменяемый снимок файловой системы. Хеширование добавляет
  полное чтение с диска перед ответом — нужен нагрузочный замер. Чужие
  placeholder-файлы и временные файлы после аварийного завершения процесса
  требуют ручного разбора.
- **Проверено дополнительно:** длинные/Unicode имена архивов не входят в ключ
  хранения; идентификатор владельца проверяется до записи файлов.
- **Проверено дополнительно:** отмена запроса прекращает подготовку архива
  между блоками чтения и закрывает поток. Тесты покрывают отмену до открытия,
  во время хеширования, до/во время аудита и очистку обработчика отмены.
  Реальный обрыв HTTPS-соединения во время передачи и повтор проверены в CI;
  обрыв до ответа во время хеширования остаётся отдельной живой проверкой.
- **UI скачивания:** ошибки теперь остаются на странице ресурса с RU/EN
  сообщениями, прогрессом и отменой. Тесты клиента и серверного рендера прошли;
  Playwright-сценарии ошибки 409, тайм-аута, отмены и повторного скачивания
  прошли на `e05c75b`; проверяется SHA-256 реально сохранённого файла.
  Тайм-аут и отмена используют синтетический fetch. Реальный обрыв соединения
  до ответа при хешировании остаётся отдельной проверкой. На `e1bc341` Chromium скачал реальный файл
  64 МиБ на RU/EN с проверкой размера и SHA-256; неполный ответ и ошибка потока
  отклонены. Пиковая память и реальный сетевой обрыв ещё не измерены.
- **Проверено на `a7d6080`:** три настоящих HTTPS/TCP-обрыва после 1 МиБ,
  повтор с точным размером/SHA-256 и четыре параллельных медленных скачивания
  по 64 МиБ. RSS HTTP-процесса: 262 308 → 308 336 КиБ, прирост 46 028 КиБ
  (~45 МиБ), ниже бюджета 128 МиБ. Web Stream считает очередь по байтам
  (64 КиБ), включая модераторское скачивание. Это замер одноразового CI,
  а не памяти браузера/контейнерного кеша или production-пропускной способности.
- **Проверено на `33d400f`:** все четыре CI-процесса зелёные, 1063 теста.
  При загрузке 64 МиБ наблюдаемый прирост суммарного RSS процессов Chromium
  составил 117 652 КиБ (~115 МиБ), ниже бюджета 384 МиБ. Выборки с интервалом
  не менее 50 мс включают передачу, сохранение файла и освобождение handoff URL.
  Сумма RSS повторно учитывает общие страницы; это регрессионный замер, не точный
  пик физической памяти и не доказательство возврата к исходному уровню.
  Клиент хранит блоки в Blob вместо отдельного массива ArrayBuffer.
  TCP-обрыв во втором production-процессе Next.js после первого реального чтения
  64 КиБ остановил хеширование до второго чтения, закрыл файл без download-аудита.
  Повтор скачал 64 МиБ с точным SHA-256; процесс проверки штатно остановлен.
  Пауза чтения внедрена внешним preload только в CI; соединение loopback TCP,
  без Caddy/TLS. Обычная HTTPS-передача и её обрывы проверяются отдельно.
- **Следующий шаг:** проверить память и нагрузку на целевых данных/устройствах,
  другие браузеры и отмену до ответа через production-прокси. На PostgreSQL 18
  выполнить миграции, seed дважды,
  адресный repair и оба claim/download-сценария; проверить сохранность
  пользовательских правок и поведение реальных конкурентных транзакций.
  Seed-baseline integration и browser claim/download прошли в CI. Полное
  сочетание адресного repair с обоими деморесурсами отдельно не подтверждено.

### P2-4. Инвентаризация типов перед миграцией существующей production-БД

Миграция `0024_product_type_invariant` и оба product-types integration-теста
успешно выполнены на изолированном PostgreSQL 18 в CI `01f79da`. Это подтверждает
CHECK, известный алиас tool → plugin и отказ на неизвестных значениях.
Перед применением к существующей production-БД остаётся проверить распределение
типов и резервную копию именно этой БД; CI использует одноразовый набор данных.

### P2-5. Тестовая инфраструктура: хрупкости и производительность

- root `tests/` всё ещё содержит cross-workspace integration и часть
  legacy HTTP suites; Support status-vs-status и reply-vs-status mutations
  теперь используют PostgreSQL compare-and-swap contracts, поэтому stale
  moderation/reply не может silently вернуть thread в `open`. HTTP 409
  различает final closed case и concurrent message conflict, а client
  перечитывает authoritative thread перед показом ошибки; но ownership постепенно выровнен: comment repository
  contract живёт в `packages/db/src/repositories/`; comment form/client —
  в `apps/web/src/components/`; reports, verification, follow, article-comment
  и support HTTP suites перенесены непосредственно к своим Route Handlers.
  Focused `test:reports` и `test:verification` обновлены на новые пути.
  Verification proof URL parser снова синтаксически валиден (`http/https` only) и покрыт прямым HTTP regression; hosted runner не успел поймать этот build-blocker из-за zero-step allocation. Follow GET cache contract объединён с colocated follow suite, inbox /
  preferences / Web Push correlation suite перенесён к `/api/notifications`,
  а current-session, password-change и session-revocation HTTP contracts —
  непосредственно к auth Route Handlers. Root devDependencies остаются только
  для оставшихся cross-workspace suites; перенос продолжать по мере правок;
- private GET cache source policy заменён прямыми HTTP response assertions:
  auth context, notification preferences/inbox, reports, verification, follow
  и downloads подтверждают `private, no-store` + `Vary: Cookie`, а
  products/servers/content/search/MTA directory — явный public cache contract;
- surface-тесты сверяют точные строки исходников — ломаются при
  переформатировании; при правках предпочитать regex/поведенческие проверки.
  Discover query parsing/href contract уже переведён на прямую поведенческую
  проверку; active/expired session listing проверяется через реальный PostgreSQL
  repository contract, GET/DELETE session-management и password-change route —
  через HTTP behavior tests без чтения route source. Устаревший
  `account-security-surface.test.ts` удалён; PWA/Web Push surface tests теперь
  исполняют реальный service-worker source в изолированном VM и проверяют
  cache/offline/push/click поведение вместо совпадения строк. Report workflow
  больше не имеет дублирующего source-only теста: HTTP boundary + repository
  transaction/advisory-lock tests покрывают его поведением. Server-follow
  fanout переведён с чтения исходника на unit behavior (limit, author exclusion,
  concurrency, preference suppression и push failure), а comment notification
  path — на HTTP behavior; source-check оставлен только для внутреннего comment
  transaction/counter invariant без дешёвого unit seam. Free-resource acquisition
  больше не читает UI/repository source: claim/download/idempotency покрыты HTTP,
  PostgreSQL и browser journeys, а legacy checkout redirect — прямым behavior test.
  Build retirement source-policy заменён HTTP contract + PostgreSQL lifecycle
  integration (last published → draft, fallback published version). Closed-beta
  paid/product source policies теперь проверяются поведением: checkout 503 code,
  paid create/release rejection до write, free-only listing/public visibility и
  entitlement claim/check. Build moderation UI source-policy заменён pure UI-state contract + SSR
  reviewer-artifact behavior; reviewer bytes/moderation остаются под PostgreSQL/HTTP
  integration. Download route теперь прямо доказывает использование deterministic
  latest-published selector, поэтому отдельный source-only publication test удалён.
  Build moderation/quarantine policies используют service behavior guards поверх
  PostgreSQL/HTTP integrations:
  pending/CAS/scan provenance/release event и published/quarantined trusted-restore
  state machine. Discover/workspace source checks теперь заменены rendered navigation,
  compatibility redirect и SavedPage privacy/repository behavior; legacy commerce
  workspace routes вызываются напрямую. Public-resource availability source inspection также заменён: service detail fail-closed проверяется unit behavior, а catalog safe-build scope — реальным PostgreSQL переходом `no build → unsafe build → provenance-backed clean build`. Оставшиеся source-surface тесты сокращать
  по мере изменения функций. Content API/publication/moderation/feed source policies
  теперь заменены HTTP/service/schema behaviors: cache/auth/rate-limit, server-derived
  status authority, organization access, moderation CAS/audit и published detail/feed
  separation. Product review authority/integrity source checks также удалены:
  HTTP behavior покрывает auth/manager/entitlement/conflict boundaries, а
  PostgreSQL integration теперь проверяет concurrent aggregate serialization,
  DB uniqueness и fail-closed unpublished state. Server updates/reverse
  dependencies source suites тоже удалены: реальные PostgreSQL filters,
  server-detail parallel behavior, reverse summary bounds и rendered RU/EN
  unavailable/empty/list states покрывают контракт без чтения исходников.
  Public server-directory composition, resource trust/provenance chain и
  resource-detail acquisition UI также переведены с чтения JSX/source на
  HTTP/SSR behavior: localized directory shell, full recorded SHA/scanner/signature
  facts, free/paid/entitled/manager acquisition states и ровно один latest-build
  download action при длинной build history. Account recovery source checks
  заменены чистыми proof/history/request/timing contracts; admin content
  moderation — SSR behavior controls + HTTP/service tests; RU/EN root shell
  wiring — реальным RootLayout render вместо чтения JSX-файлов. Server
  experience source checks также удалены: live authority/management проверяют
  SSR behavior suites, create/update/follow/claim — confirmation parsers, а
  server client requests используют единый tested private API policy
  (`same-origin`, `no-store`, bounded timeout/caller abort). Generic
  client-mutation source inspection удалён: server/admin confirmations уже
  имеют dedicated behavior tests, notification preferences теперь имеют
  colocated canonical parser/confirmation suite, а private cache headers
  проверяются прямыми HTTP assertions;
- классификатор использует SWC AST вместо собственного tokenizer. Неизвестные
  динамические/неразрешённые импорты остаются консервативными, ошибка синтаксиса
  останавливает запуск с путём файла; это не полный evaluator произвольного кода;
- unit-проект уже выполняется параллельно четырьмя workers; только database
  проект последовательный из-за общих очередей и точных счётчиков. Следующий
  шаг — заменять оставшиеся проверки строк исходников поведением по мере
  изменения соответствующих функций;
- policy-тест документов (`tests/mainline-repository-policy.test.ts`) —
  источник правды по составу документации.

### P2-6. Хост-тулинг не соответствует engines

Хост: Node 22.23.2 / pnpm 12.4.1; проект требует Node ≥ 26 / pnpm 12.4.2.
Хост-скрипты `pnpm dev:docker:*`, `pnpm test:isolated` работают через Docker,
но host-side `pnpm check` без контейнера невозможен. pnpm-автоустановка
зависимостей при host-run создаёт лишний `node_modules` на хосте — установка
предотвращена (`verifyDepsBeforeRun: warn`).

Репозиторий явно пинит проверенный Node 26.10.0 одновременно через
`.nvmrc` и `.node-version`; `package.json#packageManager` остаётся
источником pnpm 12.4.2. `nexus:doctor` теперь сам сверяет оба Node-файла,
показывает pin в facts и при старом Node даёт конкретную подсказку `nvm use`;
contract-test не даёт version files разойтись.

- **Следующий шаг:** обновить сам хост до repository-pinned Node 26.10.0 и
  pnpm 12.4.2 либо держать разработку строго в Docker-пути.

## P3 — гигиена и улучшения

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

- 2026-10-09 — bounded MTA master response reader заменил массив
  сетевых чанков на ограниченный геометрически растущий байтовый буфер:
  8 МиБ остаются абсолютным лимитом. Тесты покрывают 20 000 чанков по
  байту, рост за 64 КиБ и некорректные лимиты. SQL unit tests истории
  исправлены с учётом фактического формата Drizzle timestamp SQL params
  (ISO-строка, а не объект Date). Полный CI ждёт hosted-runner.


- 2026-10-09 — HTTP-кеширование каталога MTA Master ограничено
  оставшимся сроком свежести 60-секундного снимка, но не больше 30 секунд.
  Отключён дополнительный `stale-while-revalidate` для live статусов:
  старые, повреждённые и будущие метки времени, а также недоступный upstream,
  возвращают `Cache-Control: no-store`. Оба публичных API используют общий
  helper с граничными контрактными тестами; полноценный CI пока заблокирован.


- `5cd4f04`–`70e5c0e` — адресные пояснения Biome: группа ссылок и кнопки
  не является полем формы, ASCII-диапазон SMTP намеренный, тема использует
  статический локальный скрипт без пользовательских данных.

- `4be43ee`–`d7bf5a9` — адресные подавления `noThenProperty` для трёх
  намеренно awaitable моков Drizzle; переименование `.then` нарушило бы тест.

- `48d6f01` — каталог использует нативную область `<search>` вокруг формы.
- `3bd859d` — диалог закрывается кнопкой фона и Escape; фокус
  возвращается после закрытия.

- `17b95e5` — звёзды рейтинга используют фиксированные числовые ID.
- `7da7973` — повторяющиеся URL доказательств не создают дубли ссылок,
  уникальный URL служит ключом; ссылка получает читаемую подпись.

- `6cd0129`–`394d65c` — ID наблюдения проходит в историю сервера и
  используется как ключ столбца графика.
- `1f0cb38` — фиксированные ключи заглушек уведомлений.

- `0aa5bc8` — командная панель закрывается кнопкой фона; фокус поиска
  устанавливается при открытии и возвращается после закрытия.

- `2cfb4b4` — фиксированные идентификаторы ключей для четырёх loading-карточек.

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

- 2026-10-09 — восстановление повторной отправки Support привязано к SHA-256
  дискриминатору авторизованного пользователя. Другой аккаунт в той же вкладке
  не наследует UUID предыдущего; при недоступной проверке сессии восстановление
  отключается, отправка остаётся на серверном контроле. Старые v1 слоты не читаются;
  содержимое обращения по-прежнему не хранится в sessionStorage.

Уведомления: подготовлена миграция 0035 с индексами по получателю для общего
и непрочитанного inbox. Добавлены устойчивый порядок при одинаковой дате,
нормализация лимитов и PostgreSQL-тест на 20 125 строках с планами до/после.
Upgrade rehearsal теперь проверяет оба индекса. Локальные SQL-builder проверки
не подтверждают ускорение на PostgreSQL; acceptance и планы ожидают успешного CI.

### P2. Validate effective library access on PostgreSQL after migration 0036

An indexed, bounded SQL-based library replaces full in-memory entitlement
enumeration in the player workspace and provides a noindex, RU/EN
`/workspace/library` page. The view suppresses metadata for unavailable
products and never serves downloads without server-side reauthorization.
Remaining deployment acceptance:

- Run PostgreSQL integration tests for duplicated direct grants, expired
  grants, active/expired/revoked legacy licenses, unpublished or unsafe builds,
  filters, stable page order and cross-account isolation.
- Apply migration `0036` to a disposable clone and review the query plans
  and partial index usage under realistic grant volume; rehearse rollback and
  retry with the current journal head.
- Exercise a real browser download after ownership or published-build changes
  between rendering the library and requesting a file.
- Do not mistake library `ready` or legacy paid records for a license issuer
  or payment provider. Closed-beta checkout remains explicitly disabled.

These are acceptance tasks, not claims that CI/PostgreSQL already passed.

### P2. Historical build delivery race and remote artifact digest

Pinned resource downloads now query a specific current safe, published build
under the exact product ID and send a version identity response header which
the browser verifies before handing off bytes. This closes accidental
wrong-version selection and unauthorized cross-product selection, but does
**not** fully serialize moderation with storage delivery.

- Concurrent retirement/quarantine after the SQL read but before the object
  stream opens can still race. Consider transactional delivery reservations
  or an immutable, revocable artifact gate without holding DB transactions
  across a slow stream. Include a live PostgreSQL quarantine-vs-download
  test, and confirm no stale bytes are delivered after a completed revoke.
- A trusted scan and recorded SHA-256 are provenance facts, not independently
  proven file bytes on every storage backend. Download routes now require
  actual storage-provider size **and** SHA-256 metadata (or fail with 409),
  and local storage hashes the opened descriptor before delivery. A future
  remote implementation must still prove the bytes with its own trusted digest
  or bounded streaming SHA-256, not merely echo metadata from the database.
- Browser/HTTP, scoped SQL pagination and empty/noindex archive behavior have
  tests but still need an exact-SHA runnable CI acceptance pass.

Do not enable unsafe historical statuses to improve availability.

### P2. Local storage confinement: target-runtime verification and descriptor regressions

The local storage provider now opens each directory component with
`O_DIRECTORY | O_NOFOLLOW` through a pinned descriptor and opens asset files
with `O_NOFOLLOW`. It also rejects cross-boundary hard-linked files.
The security contract assumes a deployment-controlled storage root and
its ancestors and requires POSIX descriptor paths (Linux `/proc/self/fd`).
The safety suite includes rename/symlink substitution and descriptor cleanup
checks. Earlier tests were updated to distinguish the new directory handles
from the actual archive descriptor, and `.` is explicitly an invalid key.

- **Remaining acceptance:** run the complete storage suite and build on the
  project's Node.js 26/Linux container, then inspect error-path descriptor
  counts under concurrent traffic. Node 22 smoke coverage is not equivalent.
- **Boundary:** external writers with the same Unix UID can still mutate an
  already-open inode in place between the hash pass and streaming. In a secure
  deployment the storage volume must be writable only by the storage service.
  Browser SHA-256 verification rejects corrupted delivery but is not an
  authorization or revocation barrier.
- **Operations:** on a host without a trusted root or a functioning descriptor
  filesystem the provider must fail closed, never silently fall back to path
  traversal or non-atomic overwrites.


#### Cancellation at stream creation

A pre-existing race allowed `AbortSignal` to fire inside the creation of a
local file stream before its abort handler was registered. The provider could
then return a live, readable stream for an already cancelled request. The local
provider now registers the listener, rechecks `signal.aborted`, destroys the
stream and rejects the operation. The regression test cancels synchronously
inside `FileHandle.createReadStream`. Isolated Linux Node.js 22 tests passed;
full Node.js 26 repository and CI acceptance remain pending.

### P2. In-memory domain events are best-effort after a committed write

Product/build mutations and audit rows commit independently of in-memory
subscribers. EventBus now converts synchronous and asynchronous subscriber
failures into settled results, and logs only event identifiers and failure
counts. ProductService does not turn post-commit dispatch exceptions into
an HTTP failure that would trigger deletion of a referenced archive.

- **Remaining limitation:** the event bus is not a persistent outbox. An event
  may be lost if the process terminates after database commit. Critical
  external effects require a transactional outbox with durable retries.
- **Acceptance:** run post-commit resilience tests on Node.js 26 and verify
  database records and retained files with PostgreSQL in CI.

### P2. MTA master-list stream cancellation needs target-runtime acceptance

The MTA directory reader now rejects invalid/oversized declared lengths before
buffering, initiates cancellation without waiting on a potentially stalled
upstream stream, and listens to the endpoint timeout during body reads. A
malfunctioning mirror must not block fallback to another configured mirror.

- **Remaining acceptance:** run bounded-reader tests on the required Node.js 26
  runtime and verify fallback during real upstream stalls. The current hosted
  GitHub runner blocker still prevents an exact-SHA CI/browser acceptance pass.

### P2. Organization server registration scope needs live acceptance

Server registration now offers an authenticated, bounded list of organizations
owned or managed by the current user (owner/admin roles or explicit
manage_servers permission). The chooser returns only ID, name and slug.
This is not an authority grant: POST /api/servers rechecks rights. A failed
lookup leaves personal registration usable and organization choice disabled.

- Remaining acceptance: run the PostgreSQL role/permission/revocation tests,
  browser registration for an owner and delegated manager, and a scenario
  where organization rights are revoked between option loading and creation.
  CI-001 still prevents exact-SHA hosted acceptance.

### P2. Atomic organization server creation and post-commit events

Server creation now checks organization ownership / manage_servers membership
inside the same PostgreSQL transaction as the server and audit insert. Share
locks prevent a concurrent owner transfer or membership permission revocation
from slipping between the authorization read and durable write. This is a
separate control from the UI organization selector, which is never authority.

The in-memory server.created event remains best-effort after commit; a handler
or dispatch failure must not return a false server-registration failure.
Delivery is not durable and still needs an outbox if guaranteed events become
a product requirement.

- Remaining acceptance: PostgreSQL role-revocation and concurrent-write
  tests on the target DB, plus event-dispatch regression tests on Node 26.
  CI-001 currently prevents hosted exact-SHA execution.

### P1. Owner edits: transactional authorization, stale forms and uniqueness

Owner-facing PATCH now uses `updateManagedWithAudit`, which locks the server
row and then locks the applicable organization/permission rows before
updating metadata or writing its audit event. A revoked organization manager
cannot reuse a previously rendered form to update a server. The older
`updateWithAudit` helper remains for explicitly trusted internal migration
and test paths; it is not used by HTTP mutations.

An optional `expectedUpdatedAt` UTC/offset ISO timestamp rejects stale
updates with `409 SERVER_METADATA_CONFLICT`. The UI sends this token and
renders localized reload guidance. Editor timestamps increase monotonically
at millisecond precision even for immediate successive saves.

Known PostgreSQL slug and endpoint uniqueness constraints now return
actionable 409 errors, without returning database exception details. The
owner-facing API returns application error codes only for typed `AppError`.

- Acceptance: run transaction role/revocation/stale-edit unit tests and
  PostgreSQL integration and race tests on Node 26, followed by RU/EN browser
  checks and exact-SHA GitHub Actions verification. CI-001 still blocks
  hosted execution; no successful test run should be inferred.

### P1. Owner canonicalization and complete save acknowledgments

The server service now derives the personal owner from the authenticated actor
and never accepts a caller-supplied owner as authoritative. Organization
registrations clear the personal owner. HTTP POST rejects unexpected fields
with a strict creation schema and bounds organization IDs.

The frontend confirmation checks the chosen organization and all submitted
editable metadata, including ordered lists. A version-guarded update must
return an incremented authoritative timestamp; otherwise the UI does not
display success. Existing callers that do not supply an organization or
revision continue to use their legacy checks.

Validation and confirmation regressions were added. Exact-SHA Node 26,
PostgreSQL, browser and full-workflow checks remain required because
CI-001 still blocks GitHub-hosted runners.

### P1. Bounded server mutation request bodies

Server creation and owner-edit routes use a shared 32 KiB JSON reader with
an actual streaming byte ceiling; forged Content-Length cannot bypass the
limit. Oversized requests return typed HTTP 413 before database mutation.
Stream cancellation is best-effort and nonblocking. Invalid JSON retains the
existing HTTP 400 schema behavior.

The personal-registration test fixture no longer passes undefined to a
defaulted organization parameter. A separate administrator-role test covers
platform-admin organization creation.

- Acceptance: run HTTP/streaming tests and typecheck on Node 26.
  CI-001 blocks exact-SHA hosted acceptance (zero steps).

### P1. Bounded mutation bodies: deadline and localized errors

The 32 KiB server registration/edit request reader now also has a ten-second
deadline against slow or indefinitely stalled client streams. The timeout
cancels the stream without waiting on an uncooperative underlying cancel
promise, returns typed HTTP 408 REQUEST_BODY_TIMEOUT, and removes its abort
listener when finished. The caller's abort reason takes precedence when the
client itself disconnects. A malformed Content-Length now cancels unread data.

Registration and management forms use one compact error-code translation
helper and new RU/EN messages for duplicate slugs, duplicate MTA endpoints,
lost organization/editing permissions, stale edits, oversized bodies and body
timeouts. Both HTTP routes share the same bounded reader.

- Local isolated Node 22 smoke check of the copied bounded-json implementation
  passed seven focused scenarios (including a stalled stream). This is not
  project Vitest/typecheck or Node 26/PostgreSQL acceptance. Dedicated Vitest
  regressions were added and remain to be run after CI-001 is resolved.

### P2. MTA server endpoint aliases and legacy normalization

The official directory has always treated case and a terminal DNS dot as
equivalent for endpoint matching, but editable server addresses previously
retained the raw form in the PostgreSQL unique (address, game_port) index.
Registration, owner updates, direct service entrypoints and their forms now
share a domain-level canonicalizer. Both create/update Zod contracts reject
empty, URL-shaped, credential-shaped, host:port and malformed address values
while preserving IPv4, DNS and IPv6 spellings. Unit regressions cover equivalent
hosts and invalid forms.

**Remaining DB acceptance:** audit existing rows for canonically equivalent
(address, game_port) tuples before adding any normalized database-level unique
index. Do not automatically rewrite legacy addresses or add the expression
constraint before resolving collisions and ownership claims. The raw unique
index remains as a backstop for newly canonicalized writes, but legacy aliases
and internal direct DB writers need a separate data migration. Exact-SHA Node
26/PostgreSQL/browser CI is still blocked by CI-001.

### P1. Endpoint audit before canonical database uniqueness

The shared MTA hostname canonicalizer now parses bracketed and unbracketed IPv6
using the platform URL parser, canonicalizes equivalent IP spellings and IDN
hostnames, and rejects malformed hostnames and embedded ports. Focused checks
passed in the isolated Node 22/TypeScript harness; Node 26/Vitest acceptance
remains outstanding.

Run `pnpm --filter @nexus/db server:endpoint:audit` against a read-only
PostgreSQL account to get only summary counts. The command performs no UPDATE
or DELETE and returns exit code 2 if invalid, noncanonical, or colliding
endpoints were detected. Detailed addresses and IDs require BOTH
`NEXUS_SERVER_ENDPOINT_AUDIT_ACK=YES` and `--details`; handle output as
sensitive operational data. This is an operator audit, not an automatic fix.

Outstanding: resolve legacy duplicates and ownership claims case by case,
then design an indexed database-level uniqueness guard. Audit results are not
transactionally frozen; rerun immediately before any future migration. Full
DB acceptance is blocked by CI-001 until hosted runners execute.

### P1. Endpoint audit now highlights claims and verified server collisions

The read-only endpoint scanner also fetches ownership scope (personal owner,
organization owner, unclaimed) and verification flag. The default output keeps
all IDs and network endpoints private and reports only total invalid, mixed
ownership, unclaimed, duplicate, cross-ownership and verified-collision counts.
Detailed owner scopes, server IDs and verified IDs are returned only with
`--details` and the explicit acknowledgement environment variable.

Any collision involving distinct owners, an unclaimed server and a claimed
server, or a row with both personal and organization ownership is classified
as requiring manual attention. Verified listings are highlighted separately
so owners' verification evidence and server claim challenges are not silently
transferred. This audit does not authorize automatic normalization or changes
to license/server ownership.

Remaining: operate on the actual database with a read-only PostgreSQL user,
compare the report with server claims, then implement a reviewed and reversible
migration. No DB records have been changed by this development block.

### P1. Consistent endpoint audit snapshot and compact report mode

The PostgreSQL endpoint census now executes all keyset pages in one
`REPEATABLE READ, READ ONLY` transaction. This avoids mixing server rows from
different points in time while users create or transfer listings. The
operator must still re-run the audit just before any future constraint
migration; the transaction snapshot does not freeze changes after it ends.

Without `--details`, the collector retains aggregate counts, canonical
endpoint keys, and only the first ownership scope needed to classify
duplicates. It no longer retains lists of per-row IDs, invalid addresses
or complete owner scopes in the default command. Exact collision detection
still requires memory proportional to the number of distinct endpoints.
Explicit `--details` keeps the full sensitive review report for operators.
The summary schema and CLI exit codes are unchanged.

Local isolated strict TypeScript compilation and Node.js 22 assertions passed
for both reporting modes and a 3001-row synthetic dataset. Full Vitest,
Node.js 26, browser and PostgreSQL integration remain unverified until CI-001
runner allocation is repaired.

### P1. IPv6 canonicalization fixture and malformed IPv6 dotted variants

Fixed a regression in `tests/mta-address-normalization.test.ts`:
WHATWG URL hostname canonicalization returns bracketed IPv6
(`fe80::ABCD` becomes `[fe80::abcd]`), not an unbracketed host.
The canonicalizer now rejects terminal DNS dots on IPv6 literals
(including `[::1].`), while continuing to support the DNS-only trailing
dot convention. Added focused audit regressions for expanded IPv6
spellings and ownership conflicts.

A dependency-free Node.js test file
(`scripts/tests/mta-endpoint.node-test.mjs`) is automatically discovered
by the existing tooling test runner. The isolated Node.js 22 run with
`--experimental-strip-types` and a strict TypeScript check passed;
Node.js 26 and full Vitest/PostgreSQL acceptance remain outstanding.
CI-001 is still a runner-allocation issue, not a test-result verdict.

### P2. Scoped organization server permissions and fail-closed workspace access

The read-only server management workspace no longer loads every membership
of the signed-in user. It fetches the current organization first, denies an
orphaned organization listing, then reads at most one organization/user
membership with only organizationId, role and permissions. Direct organization
owners and platform administrators retain their existing access. The mutation
repository still rechecks permissions under PostgreSQL row locks; the workspace
view is not a substitute for the write authorization.

The delegated `manage_servers` rule is centralized in `@nexus/domain`
and shared by both the security policy and the transactional server repository.
The organization option picker and SQL workspace listing use the same owner,
admin and explicit permission categories. Focused Vitest and integration tests
cover missing organizations, scoped roles, revoked permissions, malformed
membership scopes and the current owner override.

Twelve pure, dependency-free permission cases passed on local Node.js 22 and
the helper passed strict isolated TypeScript compilation. Full Node.js 26,
Vitest, PostgreSQL and browser acceptance remain outstanding until CI-001.

### P2. Private server activity: database and migration acceptance

The RU/EN management history at `/workspace/servers/:id/activity` now reads
twenty allowed server-target audit events per page with a SQL-resolved cursor.
Fresh personal/organization management rights and activity share a read-only
repeatable-read snapshot. The SQL scope requires a live organization before a
delegated membership can grant access. Administrators retain the existing
maintenance override; moderators have no additional private-history permission.
Only public author fields and allowlisted submitted listing field names are
selected. Raw details, IP/user-agent, proof tokens and field values are omitted.
Verification-target decisions and ownership-transfer history remain future work.

Migration 0037 adds the target/time/ID index and advances the upgrade fixture.
The fixture checks index order and preservation of a pre-existing audit row.
A PostgreSQL test covers tied/microsecond timestamps, 63-event pagination,
newer inserts, missing/foreign/deleted anchors, orphaned memberships and revoked
authority. Real PostgreSQL, production query plans, migration rehearsal, browser
and complete build acceptance still require a working target runner (CI-001).

### Fixed: compatibility regressions in concurrent main integration

The combined code gate found missing support JSON-parser exports after the
server parser replacement, a nullable digest-header narrowing error, a scoped
membership return type mismatch, and a storage test outside its provider scope.
The support parser's original tagged-result contract was restored while retaining
the bounded/deadline server reader. Types and the storage test scope were fixed.
The oversized media-header fixture now uses a long parameter instead of trailing
spaces that the Fetch Headers implementation removes before validation.

Behavior tests also exposed registration defaults leaking into partial server
updates through Zod `partial()`: a description-only request could reset visibility,
ports, capacity and arrays, and empty/token-only requests could pass validation.
The update schema now removes defaults from those six fields before making them
optional. Existing creation defaults, endpoint canonicalization and strict PATCH
authorization remain in place. Missing fields stay absent and empty edits are
rejected; HTTP and schema regressions exercise this behavior.

The combined Node.js 26 `pnpm check:code` passed with 1,933 unit tests,
247 tooling tests, TypeScript, Knip and dependency checks. Lint has 55 existing
warnings; dependency-cruiser retains its TypeScript 7 compatibility warning
while the configured SWC dependency analysis succeeds. These code results do
not substitute for PostgreSQL, migration, browser or complete-build acceptance.


### Organization server verification lifecycle — 2026-10-10

Fixed organization approval assigning its manager as a personal owner and claim
writes trusting an earlier service-layer membership read. The repository now
locks and rechecks current organization ownership, administrator role or delegated
server grant at issuance, consumption and approval. Organization approval retains
the organization and clears legacy personal ownership; foreign personal ownership
still blocks claims. Scope snapshots reject legacy, transferred and deleted-org
proofs independently of endpoint revision.

Migration 0038 adds explicit scope recording and a bounded target/time/ID status
index. Legacy scope is false/null and cannot be inferred/backfilled; reject old
pending requests before issuing new proof. The release-upgrade fixture targets
0038 and checks rollback, preservation, legacy defaults, constraint and index.

Authorized management now displays pending/approved/rejected requests without
notes or proof data and hides duplicate challenge controls while pending. Public
organization cards no longer offer personal claims. Proof/decision server audit
events commit with state changes and appear in the private timeline; reviewer
identity is displayed correctly. Claim errors are localized from stable codes,
and proof JSON is bounded with the existing media-type/size/deadline reader.

New unit scenarios and seven PostgreSQL fixtures cover both ownership types,
revocation, transfers/deletion, legacy proof, rollback and private projection.
Real PostgreSQL, upgrade rehearsal, browser and production build remain pending;
Node.js 26 `pnpm check:code` passed: 2,008 unit tests, 248 tooling tests,
TypeScript, Knip and configured SWC architecture checks (376 modules / 1,141
dependencies). Lint retains 55 existing warnings; dependency-cruiser retains
its TypeScript 7 compatibility warning. These checks do not replace acceptance
on PostgreSQL or the production runtime.

### Organization workspaces and paginated discussions

Private organization profile/team APIs and RU/EN workspaces now use existing
organization/member tables, transaction-scoped owner/admin checks, shared
optimistic revisions and atomic audits. Owners are protected, unrelated
permission flags survive edits, and non-owners can leave their own team.
Published discussions use 20-item timestamp/ID keysets with microsecond cursors,
public author projections and same-content parent previews. Posting rechecks
publication and parent scope inside the transaction; activity counters no longer
invalidate author metadata versions. PostgreSQL persistence/concurrency and
browser acceptance remain pending. Agent A added
`comments_content_created_id_idx` through migration 0042; applying and verifying
that migration on PostgreSQL remains pending. No migration was created by Agent B.

### Discovery pages and follow workspaces

Discovery and the creator/organization directories now filter before SQL LIMIT,
with stable 24-item pages, verification/name filters, server language/region/mode
and publication types. The existing official MTA index and resource/content
services remain the sources. Private follow lists use 20-item microsecond keysets
and masked unavailable targets; desired-state mutations serialize one follow key,
lock fresh target availability and notify only the first actual creation.
Five PostgreSQL fixtures, browser interaction and full production generation
remain pending. Agent A added `follows_follower_created_id_idx` on
`follows (follower_id, created_at DESC, id DESC)` through migration 0044 for
large private lists. Applying it and checking PostgreSQL query plans remain
pending; Agent B's discovery block did not change schema or migrations.

### Publication feeds and discussion management

Following feeds and public user/organization publication histories now use
20-item microsecond keysets. Actor scope comes only from the session, and multiple
matching follows cannot duplicate a publication. Server/resource affiliations
require current public availability; public author DTOs exclude account data.
Discussion edits and removals lock publication/comment/current actor, compare
the displayed text revision and audit atomically. Moderators must give a reason
to remove another author's comment. Removal retains replies and decrements the
counter without changing the publication's metadata revision; deleted text is
not copied into audit. Product reviews are outside this contract.

After integration with Agent A's acquisition/activity block, 259 focused unit,
HTTP, SQL-builder and SSR checks, TypeScript, touched-file Biome and Next compile
passed. Dependency analysis reports no violations but retains the TypeScript 7
compatibility warning. Agent A removed the unused `ResourceActivityService` class
export in the commercial-plan block. Knip was unavailable in that local workspace;
the combined unused-export check still needs to run in a provisioned environment.

Six prepared PostgreSQL fixtures (deduplication, microsecond traversal, private
affiliations, concurrent edits, parent removal, live role/rollback) have not run
locally. Browser interaction, full production generation and production query
plans remain pending. Agent A implements the following index contract in schema
and migration 0046; Agent B adds no schema or migration:

```sql
CREATE INDEX content_public_feed_time_id_idx
  ON content ((coalesce(published_at, created_at)) DESC, id DESC)
  WHERE status = 'published';
CREATE INDEX content_public_author_feed_time_id_idx
  ON content (author_id, (coalesce(published_at, created_at)) DESC, id DESC)
  WHERE status = 'published';
CREATE INDEX content_public_org_feed_time_id_idx
  ON content (organization_id, (coalesce(published_at, created_at)) DESC, id DESC)
  WHERE status = 'published';
```

### Community report submission, private tracking and case moderation

Publication/discussion reporting now includes working forms, private owner
history/details, filtered community moderation queues and direct case links.
The new workspace/admin APIs enforce session scope, private/no-store responses,
JSON byte/deadline limits, rate limits and RU/EN errors. Staff-only notes and
reporter IDs are excluded from owner DTOs; owner target previews require a
currently published publication. Duplicate reports are serialized with the
existing advisory key and include both open and under-review states, also in
the legacy report repository.

Staff decisions recheck current database roles, compare the displayed report
state, and require the exact current text revision for comment removal. Removal,
counter update, report resolution and both audits share a transaction. Replies
remain and content metadata revisions are unchanged. Current commercial review
comments are excluded; unavailable historical targets cannot be removed here.
Stored notifications contain only status/direct case links, never staff notes.
Submission/decision results must be confirmed before UI success, and uncertain
writes direct users to reload their persisted reports.

97 focused unit/HTTP/SQL-builder/SSR checks, TypeScript, touched-file Biome and
Next webpack compile mode passed. Dependency analysis found no violations but
retains its TypeScript 7 compatibility warning. The previously reported unused
`ResourceActivityService` export is removed in Agent A's integrated commerce
block; Knip passes after integration with the verification workspace.
Seven new PostgreSQL fixtures cover deduplication, public scope, privacy,
orphaned replies, decision races, live roles/audit rollback and product-review
exclusion. They have not run locally: PostgreSQL, browser interaction and full
production generation remain pending.

Agent A implements the following index contract in schema and migration 0047.
No schema/migration is added by B; existing staff status/time queue indexes are
reused:

```sql
CREATE INDEX reports_reporter_created_id_idx
  ON reports (reporter_id, created_at DESC, id DESC);
CREATE INDEX reports_reporter_pending_target_idx
  ON reports (reporter_id, target_type, target_id)
  WHERE status IN ('open', 'under_review');
```

### Commercial plans and unpaid order operations

Live administrators manage immutable RU/EN plan snapshots and audited
draft/published/archived transitions with revision checks. Editing published terms
withdraws the plan; the public catalog and quote API use only its current published
revision. Duration is 7/30/90/365 days, separate from monthly resource licenses.
Commission benefits are configurable from 0–10%; quotes use integer rounding and
the original 7-day hold. They neither activate subscriptions nor book funds.
Subscription activation, provider reconciliation, paid checkout and refunds remain
unimplemented and unavailable.

Buyer-scoped payment archives omit provider references and failure details. Unpaid
cancellation accepts only a pending order without any payment attempt or ledger
reference, uses an exact order revision and a durable UUID receipt, and audits in
the same transaction. PostgreSQL guards serialize financial reference insertion
against cancellation, including fee references, and prevent reopening cancelled
orders. Migration 0045 must be applied before enabling these routes.

Local checks after integration: 199 focused contract, SQL-builder, HTTP and SSR
cases across commerce and community reports; source and
touched-test TypeScript; touched-file Biome; Next webpack compile mode. These are
not PostgreSQL or browser acceptance. The existing commerce-state integration
fixture could not connect to local PostgreSQL (ECONNREFUSED); four new persistence
and concurrency fixtures are prepared but unrun. Migrations, query plans, browser
interaction and full production generation remain unverified. Actions were not
used.

### Professional profiles and private verification workspace — 2026-10-11

`/settings/developer` persists specialties, portfolio and Discord in existing
`developer_profiles`. Writes check live roles and the shared account revision,
retain commercial counters and audit the edit. Material specialties/portfolio
changes remove `verified_developer`; identity verification remains separate.
Public user/developer profiles expose only safe professional fields and the
actual experience flag, never private evidence or default reputation scores.

`/workspace/verification` supports required evidence, own pending/history pages,
feedback, type filters and bounded current-owner/admin organization search.
API responses are private/no-store, session-scoped, rate-limited and bounded;
RU/EN includes metadata, navigation and uncertain-write recovery. Moderator
cards include current professional context; decisions recheck live staff and
organization authority, refuse self approval and compare the submitted profile
fingerprint stored in the existing request audit. Resolution, audit and requester
inbox remain transactional; MTA proof/scope checks remain intact. Existing pending
developer applications without a profile fingerprint cannot be automatically
approved. They can now submit their current profile through the pending-evidence
update described below.

129 focused contract, service, HTTP, SQL-builder and SSR checks pass, including
existing MTA control-proof and community-report regressions. After rebasing on
Agent A's release-control block, 207 checks across 22 files pass, including the
commercial release/library regressions. TypeScript,
touched-file Biome, Knip and Next webpack compile mode pass. Dependency analysis
reports no violations (579 modules / 2115 edges), with its TypeScript 7 warning.
Five new PostgreSQL fixtures cover persisted experience, invalidation, duplicate
applications, shared-version races, stale-profile rollback, self review, revoked
roles and revoked organization grants. These fixtures are unrun; live PostgreSQL,
browser interaction and full production generation remain pending. No schema,
migration, npm dependency or workflow is changed by this block.

Index contract for Agent A, needed for large requester histories:

```sql
CREATE INDEX verification_requests_requester_created_id_idx
  ON verification_requests (requester_id, created_at DESC, id DESC);
```

### Organization ownership, private history and access notices — 2026-10-11

The organization workspace now transfers ownership to a current team member
through POST `/api/workspace/organizations/[id]/ownership`. Only the actual
owner may transfer; platform staff and legacy owner memberships do not grant
that authority. The write locks the organization and affected memberships,
checks the shared revision, selected account and exact slug, and retains an
explicit member/admin role for the former owner. Existing delegated permissions,
verification and profile fields remain intact. Role changes, owner, audit and
both inbox notices share one transaction. Push enqueue failures use a savepoint
and cannot invalidate the saved state. Other team access changes now produce
the same bounded, localized inbox notices.

GET `/api/workspace/organizations/[id]/activity` and
`/workspace/organizations/[id]/activity` provide current-owner/admin-only history
using a read-only repeatable-read snapshot. Twenty-item pages resolve an opaque
anchor inside the same organization and preserve PostgreSQL microseconds;
foreign/expired anchors fail explicitly. Responses allowlist public identities,
actions and field/role labels, excluding raw audit details, account contacts,
proof, network metadata and permission arrays. Both languages include forms,
metadata, errors and reload recovery. Confirmed writes remain confirmed when a
subsequent refresh fails.

271 focused checks across 22 files pass; after integration with Agent A's
financial-journal block, 320 checks across 26 files pass, including organization,
professional verification, community publication, resource-release and financial
regressions.
TypeScript, touched-file Biome, Knip and Next webpack compile mode pass.
Dependency analysis reports no violations (600 modules / 2216 edges), with its
TypeScript 7 compatibility warning. Eight PostgreSQL fixtures are prepared for
persisted roles, grants, inbox/outbox, competing transfers, rollback, revoked
history access and microsecond pagination; they remain unrun. Live PostgreSQL,
browser interaction and full production generation still require verification.
This block changes no schema, migrations, npm dependencies or workflows and
does not use Actions.

Profile-privacy schema contract (integrated by Agent A in migration 0051;
settings, API and public filtering implemented by Agent B — see below):

```sql
CREATE TABLE user_profile_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  show_activity boolean NOT NULL DEFAULT true,
  show_professional_contacts boolean NOT NULL DEFAULT true
);
```

Missing rows preserve the current public visibility. Preference writes must use
the shared `users.updated_at` revision and update it in the same transaction;
notification preferences must not be repurposed as profile privacy settings.

### Support search, requester lifecycle and private status history — 2026-10-11

`/support` and `/admin/support` now expose shareable, bounded subject/case-number
search, status/category filters and pagination. Count and page reads use the
same filter and repeatable-read snapshot; search escapes literal LIKE syntax.
Staff queue reads recheck the current role inside that snapshot. Private support
pages check sessions before rendering and use RU/EN no-index metadata.

Requesters may resolve their own case and reopen a resolved case. Staff-closed
cases require current staff to reopen. Reply/status writes lock the actor and
case, recheck current authority, retain unrelated context and advance a monotonic
revision. Current forms send the observed revision; same-status ABA changes are
rejected. Legacy staff API clients retain their existing status precondition;
requester status actions require a revision. Idempotent reply retries retain the
original revision and request key across same-tab recovery, without storing
private message text. Replays also recheck current private-case access.

Requester inbox notices for staff replies and status changes share the write
transaction with audit. Optional push enqueue uses a savepoint; a failure cannot
invalidate the saved inbox/state. Staff queue alerts remain post-commit best
effort. All new notice previews omit case subjects and message bodies. Closed
threads remain read-only. An already confirmed creation/reply remains confirmed
when a subsequent read fails.

GET `/api/support/[id]/activity` exposes twenty-item status history with current
requester/staff authority and opaque, case-scoped anchors. SQL preserves cursor
microseconds and allows only status transitions, role labels and timestamps;
raw audit details and account/network fields never enter the response. Foreign
or expired anchors fail explicitly. Thread history loads on demand. Both
languages include filters, lifecycle controls, errors and saved-state recovery.

326 focused checks across 25 files pass after rebasing onto Agent A's resource
review lifecycle block, covering support and existing organization, verification,
publication, financial, release-control and resource-review APIs. TypeScript,
touched-file Biome lint, Knip and Next webpack compile mode pass. Dependency
analysis reports no violations (634 modules / 2366 edges), with its TypeScript 7
compatibility warning.
Eight new PostgreSQL fixtures are prepared for requester transitions, staff
closure/revocation, competing writes, ABA revisions, replay uniqueness, inbox
rollback, outbox persistence, notification opt-out and microsecond pagination.
They remain unrun; live PostgreSQL, browser interaction and full production generation require
separate verification. This block adds no schema, migration, npm dependency or
workflow and does not use Actions. Requester notification preference checks use
the existing transaction-scoped preference lock. The profile-privacy model above
is now integrated by Agent A in migration 0051; its user-facing flow is completed
in the profile privacy block below.

### Resource version workspace — 2026-10-11 (Agent A)

Draft/rejected metadata edits, pending-review withdrawal, clean-archive resubmission and
revision-checked retirement now have private RU/EN pages and bounded JSON APIs. Current
personal/organization authority is locked with the product/build; state, product version
fallback and audit commit together. Other pending/published builds keep their proper scope.
Approval/rejection requires the reviewer-observed revision, preventing pending-state ABA.
Migration 0051 adds automatic revisions for existing writers and immutable upload identity;
only the two exact development fixture identities retain their explicit seed metadata repair.
Version history is bounded to the latest 20 events and omits account/network/storage fields.
Uncertain client acknowledgements require reloading persisted state.

The Agent B `user_profile_preferences` schema contract above is fulfilled by migration 0051
and the exported `userProfilePreferences` table. Preference UI/API and visibility filtering
remain Agent B's scope; writes must advance the shared `users.updated_at` revision atomically.
The upgrade rehearsal now targets 0051, preserves legacy build/review rows, and checks the
trigger/privacy schema; a duplicate legacy-review insert in the rehearsal was fixed.
Six PostgreSQL fixtures cover ABA moderation, competing edits, immutable identity, pending
fallback, audit rollback and the demo repair scope. They remain unrun without PostgreSQL.
TypeScript, focused unit/HTTP/render checks, Biome lint, local upgrade-contract checks and
Next webpack compile mode pass. Live database/browser and full production generation remain
unverified; migration 0051 must be applied before serving these routes. No Actions were used.

### MTA observation statistics, period comparison and CSV — 2026-10-11

`/servers/[slug]/statistics` and `/workspace/servers/[id]/statistics` expose
adjacent 24-hour, seven-day and thirty-day observation periods, complete SQL
aggregates, UTC interval charts and newest-first 25-row observation pages.
Listing visibility, current organization grants / personal ownership and the
actual administrator role are evaluated in the same repeatable-read snapshot
as both periods, buckets and samples. Public access never inherits a privileged
session. Private statistics include only previously collected observations;
the existing collector still excludes inactive/private listings.

New GET `/api/servers/[id]/statistics` and its `/export` endpoint have matching
private workspace endpoints under `/api/workspace/servers/[id]/statistics`.
Strict bounded queries reject duplicate/unknown filters and require a fixed
period end for cursors. Supplied period ends are limited to the last ninety days.
Period boundaries are half-open and adjacent; anchors resolve within the same
listing, source and period at PostgreSQL microsecond precision. Missing or
foreign anchors fail explicitly. Later inserted observations may change results
within fixed period boundaries; no persistent data snapshot is promised.

Interval CSV covers the entire selected period, including unknown empty
intervals. Observation CSV exports only the displayed page. Both preserve the
chosen bounds and recheck current access. Remote text is bounded and CSV formula
prefixes are escaped. Download controls confirm CSV responses and show localized
errors. RU/EN covers metadata, loading, empty/error states, table navigation and
export actions; horizontal tables are keyboard-focusable. Average player counts
are per observation, not duration-weighted uptime. History follows the listing
across endpoint edits because the existing observation model lacks revision
provenance; the interface explicitly explains this limitation.

395 focused unit checks in 35 files pass after integrating Agent A's version
workspace block. TypeScript, touched-file Biome lint and Next webpack compile
mode pass. Knip now reports two unused commerce exports from that integration:
`RetireBuildForm` and `ResourceBuildWorkspaceRepository`; they remain for Agent A
to review. An existing resource-delivery database fixture could not start because
PostgreSQL refused the connection. Three new PostgreSQL fixtures are prepared for
persisted access revocation, disjoint aggregates and microsecond pagination;
they remain unrun. Browser interaction, live PostgreSQL and full production
generation require separate verification. This block adds no schema, migration,
npm dependency, collector or workflow and does not use Actions.

### Profile privacy, protected public feeds and professional contacts — 2026-10-11

`/settings/privacy` and GET/PATCH `/api/account/privacy` use the existing
`user_profile_preferences` model from migration 0051. Reads and writes bind to
the current session user, reject supplied scope and extra fields, rate-limit
requests and return private no-store responses. Saving locks the user, checks
the shared `users.updated_at` version, upserts both choices, advances that
version monotonically and records an audit in one transaction. Concurrent
ordinary, professional and privacy profile editors share the same version.
Missing preference rows retain legacy public visibility. No new migration or
notification preference is introduced.

The RU/EN editor loads saved choices, confirms the returned identity, exact
booleans and newer revision before reporting success, and provides explicit
saved-state recovery after conflicts, unreadable responses or uncertain writes.
Settings and professional-profile navigation link to it. The private page and
personal activity page have noindex metadata. Public user/developer profiles
omit the personal feed link when disabled; direct personal activity resolution
returns not found. The feed query independently rechecks visibility on each
page and excludes hidden user subscriptions from selected and combined
following feeds. Public activity API responses no longer retain a shared cache.

Professional public reads redact portfolio URL and Discord in SQL. Private
editing, specialties, verified experience and commerce counters remain intact.
These controls restrict personal aggregation and structured professional
contacts; published content is still public through direct links, community
and explicitly followed organization/server/resource contexts. They do not
delete existing notifications or revoke information a visitor already received.
The interface explains the public-content scope before saving.

220 focused unit checks across 22 files pass after integrating Agent A's
order-linked support block, including 162 checks for profile/feed/verification
scenarios. TypeScript, touched-file Biome lint, Knip and Next webpack compile
mode pass; Agent A removed the previously documented unused commerce exports.
Five new PostgreSQL fixtures cover persisted defaults
and restoration, public contact redaction, direct/following/context activity,
concurrent shared-version writers and transactional rollback after audit failure;
they remain unrun because PostgreSQL is unavailable in this environment. Browser
interaction and full production generation still require verification. Schema,
commercial contracts, dependencies and workflows are unchanged; Actions are not
used.

### Organization editorial workspace and discussion discovery — 2026-10-11

`/workspace/organizations/[id]/content`, `/new` and `/[contentId]` provide a
private RU/EN editorial workspace for the actual owner and current team
administrators. The bounded searchable list includes all organization authors,
status/type filters and page navigation. Editors can create, edit and archive
team publications using the existing writer schemas and publication policy.
Editorial changes return material to moderator review; posts and questions
publish immediately. Attribution, permanent slug, linked context, counters and
existing discussion remain intact. Archived publications stay read-only.

GET/POST `/api/workspace/organizations/[id]/content` and GET/PATCH/DELETE on its
`/[contentId]` endpoint bind scope to the session and path, reject injected
filters, enforce bounded JSON and rates, and return private no-store responses.
Reads use a repeatable-read access snapshot. Mutations reuse the author editing
transaction, content-first locking, current organization authority, observed
status/version, monotonic revisions and atomic audit. Legacy owner memberships
never establish ownership; the older publication-create flow now rechecks
organization rights within persistence. Platform administration grants no
automatic access to team drafts. The shared editor confirms saved fields and
team identity, exposes saved-state recovery and explains uncertain writes.

Article discussion search matches text and public author names with literal
wildcard escaping, before the twenty-row keyset limit. Search continuations
bind to the exact article/query and retain PostgreSQL microseconds.
`/articles/[slug]?comment=[id]#comment-[id]` server-loads the selected comment and
older context even beyond the first page, highlights it and continues normally.
Comment/parent permalinks and new notification links use this route; existing
hash-only notifications resolve on the client. Removed, foreign or unpublished
focused comments return a localized error with latest-discussion recovery.
Public comment GET rejects mixed/duplicate/unknown selectors, rate-limits
lookup and never increases article views. Public reads omit private identities.

249 focused unit, query, HTTP and server-render checks across 20 files pass,
including existing privacy, personal publication and organization regressions.
TypeScript, touched-file Biome lint, Knip and Next webpack compile mode pass.
Seven new PostgreSQL fixtures cover cross-author edits, live rights, concurrent
team/author edits, audit rollback, archive preservation, focused microsecond
paging, literal search and unavailable targets. They remain unrun because
PostgreSQL is unavailable here. Browser interaction and full production
generation require verification. No schema, migration, commerce contract,
dependency or workflow changed; Actions were not used.

### Managed server publications, editorial notices and reviewed revisions — 2026-10-11

`/workspace/servers/[id]/content`, `/new` and `/[contentId]` give current server
managers an all-author editorial list, title/slug search, type/status filters,
pagination, creation, editing and archiving. Server-management pages and cards
link to it. GET/POST on `/api/workspace/servers/[id]/content` and GET/PATCH/DELETE
on `/[contentId]` use the existing private API wrapper, strict bounded filters,
JSON limits, rates and localized errors. The shared editor confirms server
identity, saved fields and newer revision, with explicit uncertain-write recovery.
New server material accepts editorial types only and enters moderator review.

Read authority and bounded projections share a repeatable-read snapshot. Writes
reuse publication schemas, the author mutation, content-first locks and observed
status/version. Actual personal/organization owners, current administrators and
explicit `manage_servers` delegates are checked on the server; the platform-admin
override reads the actual account role. Legacy author and organization editors
also recheck linked-server authority. Creation forces current server organization,
authorship, draft state and empty counters. Editing preserves author, slug, linked
context and discussion; archived material is read-only. Stale membership `owner`
roles and unknown roles no longer grant server management, consistently across
policy, managed-list SQL and server-organization choices. Ownership uses the
actual organization row. Publication-only organization access uses share locks
to avoid lock upgrades and preserve the server/organization ordering.

Publication creation, edits, archives and moderator decisions now store
status-only inbox notices atomically with content and audit. Recipients are the
original author and actual context owner, deduplicated with the actor omitted;
this does not broadcast drafts to the whole team. Existing content preferences
are locked and checked, absent rows retain default delivery. Notice identities
derive from audit/recipient, include no draft body or moderation notes, and link
to the recipient's author/team/server workspace. Existing push outbox enqueue
uses a savepoint, so push degradation cannot erase a committed inbox notice.
RU/EN notification presentation and workspace explanations are included. Existing
public server-follower fanout remains unchanged and best effort after publication.

Content actions on `/api/admin/actions` now require the reviewed `expectedUpdatedAt`
and a note. The moderator UI supplies its displayed revision and offers reload
after stale or uncertain decisions. Persistence locks content and the live
moderator role, checks status/version, advances revision monotonically and stores
the notice. A parallel draft-to-draft edit cannot publish unreviewed text. Product,
build and other commercial action contracts are unchanged.

275 focused unit/query/HTTP/render checks across 27 files pass. TypeScript,
touched-file Biome lint, Knip and Next webpack compile mode pass. Five new
PostgreSQL fixtures cover persisted delegated creation and notices, competing
team/author edits with preference opt-out, revoked server access, concurrent
review/edit and revoked moderator authority, and rollback after inbox failure.
They remain unrun without PostgreSQL; browser interaction and full production
generation still require verification. No schema, migration, dependency or
workflow changed; Actions were not used.

### Public server publication archive and durable feed navigation — 2026-10-11

`/servers/[slug]/updates` exposes the complete moderated server archive through
the existing publication feed, linked from the six-item server preview. Public
scope resolution and every publication query require an active, public server.
GET `/api/activity/server/[handle]` reuses the public activity API with strict
filters, bounded cursors, rate limiting, safe RU/EN errors and no-store responses.
The archive allows only editorial types; drafts and community-only server posts
are excluded. Public user activity privacy and commercial resource availability
predicates retain their existing behavior.

All public user/organization/server archives and `/workspace/feed` now support
author username and exact tag filters, author-name text search and links from
authors/tags to the filtered archive. Filters run before the 21-row sentinel
limit. Summaries include at most ten thirty-character tags and public author
fields, without full bodies, account details or server endpoints.

Older/newer keysets preserve microsecond timestamps and ID tie breaks. Versioned
continuations bind to the actual scope ID, session account for following feeds,
and normalized filters. Reusing a cursor under another scope or filter fails
before querying. Page URLs retain filters and cursors for reload, sharing and
browser history. SSR and API use the same strict parser; invalid pages provide
localized recovery without querying publications. Loading, filtered empty,
unavailable and stale-empty page states are localized. Navigation is rendered
as working links; latest/retry perform fresh reads, and result links disable
automatic prefetch. Concurrent retraction may leave an empty page, with latest
page recovery; this is a live feed, not a frozen catalog snapshot.

203 focused checks across twenty unit/query/HTTP/render files, TypeScript,
touched-file Biome, Knip and Next webpack compile pass. Five new PostgreSQL
fixtures cover bidirectional equal-microsecond traversal, pre-limit filters,
revoked public scope, privacy/projections and cursor scope integrity. They remain
unrun without PostgreSQL. Browser interaction and full production generation
still require verification. No schema, migration, dependency or workflow changed;
Actions were not used.

Agent A owns the following performance index contract. It is not yet integrated;
the archive works on the existing schema, but large-server query plans still need
verification after the index is added:

```sql
CREATE INDEX content_public_server_feed_time_id_idx
  ON content (server_id, (coalesce(published_at, created_at)) DESC, id DESC)
  WHERE status = 'published';
```

### Publication reactions and public trust signals — 2026-10-11

`/articles/[slug]` now supports helpful, thanks and insight reactions through
GET/PUT `/api/content/[slug]/reactions`. PUT saves an explicit desired state
(including removal), so retries do not toggle votes. Publication-first locking,
an actor/target advisory lock and live-account checks serialize changes without
new schema. Authors cannot react to their own publications; old self votes can
be removed and never contribute to counts. Draft, archived and unsupported
targets reject public commands. Legacy duplicate rows are normalized on writes;
reads count only the latest supported reaction per reader. Public article/card
helpful counts derive from actual rows, including account cascade deletion,
instead of seed values or an outdated cache. Counter maintenance does not change
publication revision, status or publication time, or developer reputation.

Changes persist with audit and a status-only author notice in the transaction.
Content preferences use the existing lock and default delivery policy. Stable
actor/publication notice IDs prevent repeat inbox/push delivery on retries,
switches and removal/re-addition while the inbox row exists. Push enqueue uses a
savepoint; inbox/audit failure rejects the authoritative operation. Notification
previews expose no publication title/body or reacting account identity.

`/workspace/reactions` and GET `/api/workspace/reactions` provide title search,
reaction filters, twenty-item keyset pages and exact microsecond continuation.
Cursors bind to account and normalized filters. SSR and API reject unknown or
repeated parameters. Missing/nonpublic targets have null title/slug/type in SQL.
DELETE `/api/workspace/reactions/[id]` removes only the current user's reaction,
including orphan rows; its response contains no target metadata. Unknown own
targets are idempotent no-ops. Interfaces wait for exact-target confirmation,
show loading/error/success states and require saved-state recovery after an
uncertain result. Workspace/mobile navigation, metadata and all copy use RU/EN.

`/users/[username]/trust` and GET `/api/users/[username]/trust`, linked from user
and developer profiles, expose a single narrow snapshot: current identity and
role-eligible developer verification, latest recorded approval dates only for
active badges, account creation, current organization ownership and active public
server ownership with verified subsets. Publication totals and activity links
honor profile privacy. Evidence, reviewer/notes, rejected/pending requests,
default reputation scores, commercial records and unsupported sanction/history
claims are absent. The page explains the source and scope of each signal; it
does not claim a complete historical record or guarantees of quality.

216 focused checks across 28 unit/query/HTTP/render files pass, alongside
TypeScript, touched-file Biome lint, Knip and Next webpack compile mode. Seven
new PostgreSQL fixtures cover concurrent retries and notice deduplication,
legacy duplicates/self votes, unavailable-target cleanup, audit rollback and
preference opt-out, microsecond pagination/account-bound cursors, trust privacy
and live roles/ownership, and helpful counts after account deletion. PostgreSQL
fixtures remain unrun in this environment; browser interaction and full
production generation still need verification. No schema, migrations,
dependencies or workflows changed. Actions were not used.

Agent A owns these nonunique performance index contracts. No conflicting
migration is introduced; large-catalog PostgreSQL plans need verification after
integration. A unique index would require separate legacy-row cleanup first.

```sql
CREATE INDEX reactions_content_target_reader_latest_idx
  ON reactions (target_id, user_id, created_at DESC, id DESC)
  WHERE target_type = 'content';
CREATE INDEX reactions_content_reader_target_latest_idx
  ON reactions (user_id, target_id, created_at DESC, id DESC)
  WHERE target_type = 'content';
```

### Buyer notices for future resource releases — 2026-10-11

Migration `0057` records immutable exact-build release events in successful
moderation transactions and private, revision-checked buyer watches. Enrollment
requires live library access and a safe published version, starts after existing
events and is limited to 100 active watches per account. Retained-artifact
reapproval does not repeat a release. Disabling remains possible after access
loss. RU/EN version controls, a filtered twenty-row watch archive and authenticated
bounded APIs expose neither internal progress nor other buyers.

A bounded standalone worker runs after app readiness in DEV/production Compose.
Parent/account/grant/watch and notification-preference locks serialize delivery
with publication, access revocation and opt-out. It rechecks the exact build and
finite grant expiry before writing inbox, progress and audit atomically. Lost
access disables the watch; unavailable builds or disabled preferences consume the
event without replaying it later. Optional push enqueue uses a savepoint, so
queue degradation preserves inbox delivery. Health heartbeat and signal handling
are included. Watches grant no access and change no download pin or financial
state. Existing publications are not backfilled.

73 focused checks across twelve unit/query/HTTP/render files, TypeScript,
touched-file Biome, 22 local migration-contract checks and Next webpack compile
mode pass. Four new PostgreSQL fixtures cover concurrent delivery, baseline and
retained-artifact reapproval, opt-out, access revocation, immutable event guards
and approval rollback. They remain unrun without PostgreSQL. Docker execution,
browser interaction, external push dispatch and the pinned Node 26 runtime still
require verification. No workflow was used or modified.

### Own discussions and recorded verification approvals — 2026-10-11

`/workspace/discussions` and `/workspace/discussions/[id]`, backed by GET
`/api/workspace/discussions` and GET/PATCH/DELETE `/api/workspace/discussions/[id]`,
provide a private, searchable cabinet of the session user's publication comments.
Availability filters, twenty-item keyset pages and account/filter-bound cursors
preserve exact database microseconds. SQL excludes product reviews and other
authors, masks unavailable publication titles/slugs/types, and gates title search
on the same public predicate. Legacy oversized comments have bounded previews,
a full-text revision and removal without editing. Invalid or repeated parameters,
client identity/context overrides and oversized mutation bodies are rejected.

Own commands reuse the existing content-first locked discussion mutation. Live
account and ownership checks occur again under locks; administrators cannot use
the private cabinet to manage another author's comments. Public text editing uses
revision comparison; own removal remains available for draft/archived parents.
Replies survive deletion and the guarded counter does not change publication
revision/status/time. Exact-target confirmation precedes UI success. Failed or
uncertain mutations require saved-state recovery. RU/EN screens, errors, loading,
empty states, metadata and workspace/mobile/discussion navigation are included.

Moderator removal now writes a content-preference-aware author notice in the
deletion/audit transaction. Previews contain no comment text, publication title
or private moderation reason. Self removal produces no notice. Stable operation
IDs avoid duplicate delivery; push enqueue is isolated in the existing savepoint
pattern. Mandatory audit/inbox failures reject the authoritative operation.

`/users/[username]/trust/history` and GET `/api/users/[username]/trust/history`
expose only retained, dated, approved identity/developer requests. Current flags
and twenty historical records are read in one read-only repeatable snapshot.
Optional type filters and subject/filter-bound cursors use exact resolved time
and opaque public record keys. Evidence, application IDs, reviewer identities,
notes, pending/rejected requests and commercial data are not selected or emitted.
Current flags are displayed separately: an old approval does not establish current
verification, and an absent record does not imply a rejection or misconduct.
This is not a full lifecycle ledger; deleted/reclassified legacy records cannot
be reconstructed from the existing schema.

After rebasing on Agent A's release-watch work, 386 focused unit/query/HTTP/render
checks across 32 files and touched-file Biome pass. TypeScript and Knip passed
before integration; the combined main is currently blocked by an upstream
missing `isSigned` fixture field in `tests/resource-deliveries.integration.test.ts`
and an unused exported `ResourceReleaseWorkerRepository` class. Agent A owns
those commercial files; this change preserves them. Next webpack compile mode
is checked separately. Six PostgreSQL
fixtures prepare archived removal/reply preservation, private-context masking,
concurrent revision edits/live roles, atomic moderation notices/opt-out, audit
rollback and microsecond own/history traversal. They remain unrun without a
local PostgreSQL instance. Browser interaction, full production generation and
large-catalog query plans still need verification. No schema, migrations,
dependencies or workflows changed; Actions were not used.

Agent A owns these additional nonunique index contracts. No migration is created:

```sql
CREATE INDEX comments_publication_author_time_id_idx
  ON comments (author_id, created_at DESC, id DESC)
  WHERE product_id IS NULL AND content_id IS NOT NULL;
CREATE INDEX verification_public_approval_target_time_key_idx
  ON verification_requests (target_type, target_id, resolved_at DESC, (md5(id)) DESC)
  WHERE status = 'approved' AND resolved_at IS NOT NULL;
```

### Public context verification and private organization team directory — 2026-10-11

`/organizations/[slug]/trust`, `/servers/[slug]/trust` and GET
`/api/trust/[kind]/[slug]` expose current recorded verification, public publication
counts and retained dated approvals. Organization counts exclude hidden and
inactive servers; server pages require active public state before approval reads.
Server affiliation and management context expose no personal owner identity or
network endpoint. Explicitly qualified correlated counts retain the outer subject
reference even when Drizzle unqualifies a single-table selection.

One shared read-only repeatable-snapshot approval query now serves users,
organizations and servers. Twenty-item cursors retain database microseconds and
opaque tie keys, bound to the resolved subject and context. Existing user cursor
namespaces remain compatible. Evidence, request IDs, applicants, reviewers,
notes, pending/rejected applications and commercial records are excluded. Current
flags remain separate from history: old approvals do not establish current
ownership or verification; this retained-record view is not a lifecycle ledger.

`/workspace/organizations/[id]/team` and GET
`/api/workspace/organizations/[id]/team` provide a private team directory with
public-identity search, role and effective server-access filters, twenty-member
keyset pages and account/organization/filter-bound microsecond cursors. The
authoritative current owner is shown separately and excluded from member pages.
Administrators have effective access without explicit delegation; members and
developers require `manage_servers`. Stale legacy owner entries confer no owner
rights and are labeled accordingly. Platform administrators receive no team
access bypass. Other permission flags and private account fields are not emitted.

Role, delegation and removal use existing revision-checked member APIs, locks,
audit and transactional access notices. A shared exact-member acknowledgement
precedes success; the directory then rereads saved filtered data. Failed writes,
uncertain acknowledgements or failed refreshes block further writes until saved
state is reloaded. Existing workspace editor, ownership transfer and invitation
flows remain available through links. RU/EN forms, loading/error/empty/success
states, metadata, private noindex and public navigation links are included.

After integrating Agent A's reviewed-cart/receipt commit, 300 focused
unit/query/HTTP/render checks across twenty-three files and touched-file Biome
pass, including fifty-five commercial regression checks. Next webpack compile
mode also passes. Six PostgreSQL fixtures prepare public-count isolation, server
visibility/ownership changes, scoped microsecond approval/member traversal,
effective delegation updates preserving unrelated permissions, live authority
and mandatory-audit rollback. They remain unrun without PostgreSQL. TypeScript
and Knip still report the pre-existing commercial fixture/export issues recorded
above; the new source and prepared fixtures introduce no remaining type errors.
Browser interaction, full production generation and large-team/catalog query
plans require subsequent validation.
No schema, migration, dependency or workflow was changed.

Agent A owns these additional nonunique index contracts. The earlier public
approval index already supports the new context pages; no duplicate is needed:

```sql
CREATE INDEX organization_members_team_time_id_idx
  ON organization_members (organization_id, created_at DESC, id DESC);
CREATE INDEX servers_public_organization_idx
  ON servers (organization_id)
  WHERE status = 'active' AND visibility = 'public';
```

### Discovery stream and publication moderation workspace — 2026-10-11

`/discover/stream` and GET `/api/discover/stream` reuse the existing public
directory repository, cards, follow-state batch and official MTA observation
service. Server, creator and organization catalogs now support twenty-four-item
keyset pages, nearest newer/older navigation, exact PostgreSQL microsecond tie
keys and entity/filter-bound continuations without offsets or numbered-page
caps. Search, verification and server language/region/mode filters persist in
links. The existing numbered/alphabetical directories remain available. Public
server projections omit internal owners, organization IDs and observation
bookkeeping; public endpoints remain available for official observation matching.
Visibility and active-state gates apply to every page.

`/admin/community`, `/admin/community/[id]`, GET `/api/admin/community` and
GET/POST `/api/admin/community/[id]` provide a staff publication queue with
search, exact author, type and status filters; bounded full-text review; public
author/context links; and retained publish/archive decisions. Queue and history
pages use twenty-item exact cursors bound to the current staff account and
filters/target. Repeatable read-only snapshots recheck the current database
role before selecting private material. Commercial content, hidden server
context, account secrets and raw audit metadata are excluded from the DTOs.
Existing audit indexes serve decision history.

Decisions reuse existing content moderation, mandatory audit and preference-aware
author notices in one transaction. Current staff privilege, publication scope and
the observed revision are checked again under the write lock. Legacy texts above
100,000 Unicode characters receive an explicit partial-preview warning and
cannot be published; archiving remains possible. PostgreSQL character limits and
JavaScript UTF-16 validation agree for supplementary Unicode text. The existing
moderation buttons are also repaired: a boolean pending ref previously disabled
them permanently. Exact saved-state acknowledgement precedes success; conflicts,
network errors and uncertain replies block further writes until saved state is
reloaded. Duplicate clicks, cancellation and unmount abortion are covered.

RU/EN metadata, forms, navigation, private noindex and loading/error/empty/success
states are included. 213 focused unit/query/HTTP/render/interaction checks across
twenty-two files and touched-file Biome pass. Next webpack compile mode passes;
full production generation and browser validation remain pending. TypeScript
still reports the existing `isSigned` commercial fixture error, and Knip reports
the existing `ResourceReleaseWorkerRepository` export; this block introduces no
additional findings. Five PostgreSQL fixtures prepare exact multi-page traversal,
private server isolation, live staff revocation, history filtering, locked
publication scope, Unicode review limits and mandatory-audit rollback. They
remain unrun without PostgreSQL. No schema, migration, dependency or workflow is
changed.

Agent A owns these additional nonunique index contracts; validate query plans
against production-sized catalogs before claiming scale characteristics:

```sql
CREATE INDEX servers_public_created_id_idx
  ON servers (created_at DESC, id DESC)
  WHERE visibility = 'public' AND status = 'active';
CREATE INDEX users_creator_created_id_idx
  ON users (created_at DESC, id DESC)
  WHERE role IN ('developer', 'admin');
CREATE INDEX organizations_created_id_idx
  ON organizations (created_at DESC, id DESC);
CREATE INDEX content_moderation_updated_id_idx
  ON content (updated_at DESC, id DESC)
  WHERE type IN ('article', 'news', 'devlog', 'update', 'announcement', 'post', 'question', 'review')
    AND status IN ('draft', 'published', 'archived');
```

### Historical MTA periods and filtered observation browsing — 2026-10-11

Existing public and managed statistics pages now provide native UTC end-time
forms and adjacent-period links. The shared strict query contract normalizes
`endUtc` datetime-local submissions to canonical `end` ISO timestamps, rejects
simultaneous forms and malformed calendar values, and preserves the chosen end
when changing duration. The existing repository's ninety-day end bound is shared
with observation browsing. Session failures on managed statistics receive a safe
recoverable error, rather than escaping the page renderer.

`/servers/[slug]/observations` and
`/workspace/servers/[id]/observations`, with matching GET
`/api/servers/[id]/observations` and private workspace endpoints, browse the
existing immutable observation model. Search covers remote mode/map/MTA-version
text; filters distinguish known, unknown and zero player counts and three-state
password/response data. Twenty-five-row pages select nearest newer or older
neighbors with exact PostgreSQL UTC microsecond tuple keys. Continuations bind
to the resolved listing, access kind/account, period and every filter. Removed
anchors remain usable because continuation carries the original tuple; current
listing/grant authority is still checked on every request.

The existing server-observation repository and statistics service are extended;
statistics and browsing share the same current public/managed target selection
and period validation. Public requests remain public regardless of signed-in
administrator cookies. Organization grants and actual administrator roles are
evaluated inside a repeatable-read snapshot. Missing/revoked targets do not
trigger observation reads. Browsing uses two bounded queries and avoids period
aggregation or offset scans for each page. Owner identities, endpoints, remote
source sequences and other collection bookkeeping are absent from DTOs.

GET `/observations/export` counterparts reuse the existing CSV escaping and
download control, recheck current access, and export only the selected filtered
page. Exact observed timestamps are retained in APIs, the table and CSV.
Pagination, duration changes and exports preserve selected filters and bounds;
new periods and filter changes clear continuation. Later saved observations can
change results within fixed bounds; no persistent data snapshot is promised.
Missing telemetry does not establish downtime, and endpoint-revision attribution
remains unavailable with the existing model. Private collection is not enabled.
RU/EN metadata, noindex, accessible scrollable tables, forms and
loading/empty/error/recovery states are included.

178 focused unit/query/HTTP/render checks across fourteen files and touched-file
Biome pass. Next webpack compile mode passes. TypeScript and Knip still report
only the existing commercial `isSigned` fixture and
`ResourceReleaseWorkerRepository` export issues; new source and fixtures add no
findings. Three additional PostgreSQL fixtures prepare filtered microsecond
traversal in both directions, deleted-anchor continuation, Unicode bounds,
half-open/source isolation, current organization/admin revocation and
account/target/period cursor isolation. They remain unrun without PostgreSQL.
Browser validation, full production generation and large-catalog query plans
remain pending. No schema, migration, npm dependency or workflow is changed.

Agent A owns this additional nonunique index contract. The existing
server/time index remains usable; validate plans before claiming scaling results:

```sql
CREATE INDEX server_observations_master_server_time_id_idx
  ON server_observations (server_id, observed_at DESC, id DESC)
  WHERE source = 'mta_master';
```


### Notification history and explicit reading-state selections (Agent B)

`/notifications` now has an authenticated searchable history instead of a fixed
100-row window. GET `/api/notifications/inbox` returns 25 bounded presentation
items, a global unread count and older/newer cursors. Existing notification
storage, preference serialization, delivery/outbox and legacy bell API contracts
remain in use. Search matches stored titles/messages literally; category and
read/unread filters share the existing recipient/time/id indexes. Cursors retain
six fractional timestamp digits and bind account plus normalized filters. Newer
navigation selects nearest rows before reversing display order. Removed anchors
need no lookup. Every page is a live view, not a persistent snapshot across requests.

PATCH on the same inbox API accepts 1–25 unique IDs, their observed boolean
reading state and one explicit desired state. Rows are locked in stable ID order;
partial ownership, missing rows or changed state reject the complete transaction.
Only `is_read` changes, with no inbox deletion, new delivery or preference mutation.
The client validates the exact acknowledgement and rereads the filtered page
before reporting success. The existing whole-inbox mark-read action remains
available through its legacy endpoint, with an explicit scope confirmation.
Failed/uncertain writes or refreshes require a saved
inbox reload before another mutation. The bell rechecks after local or cross-tab
invalidation; channel payloads contain only a fixed signal, never user data.
No table, migration or new index is required. Legacy oversized text/JSON is bounded
in SQL and presentation DTOs exclude recipient IDs and raw structured payloads.

Focused checks cover SQL isolation/bounds, exact navigation, literal search,
atomic ownership/state guards, HTTP authentication/CSRF/body limits, localized
presentation, uncertain replies, cancellation and cross-tab cleanup. Three real
PostgreSQL fixtures were added for >100-row traversal, legacy limits and atomic
reading changes; PostgreSQL is unavailable here, so they remain unexecuted.
Browser interaction and production query plans still need verification. Root
checks retain the upstream `isSigned` fixture error in
`tests/resource-deliveries.integration.test.ts:53` and unused
`ResourceReleaseWorkerRepository` export; Agent B does not alter these contracts.

### Private author publication desk, retained history and guarded restoration (Agent B)

`/workspace/content` now searches an author's seven noncommercial publication
types by literal title/URL/text/tag, exact tag, status and personal/organization/
server context. GET `/api/workspace/content/desk` supplies twenty bounded summaries
and bidirectional keyset navigation; the legacy content API remains compatible.
Continuation binds account and normalized filters, retains microseconds, needs
no anchor lookup and selects nearest newer rows before reversing display order.
Pages show current state; editing can move a row to the latest changes.

`/workspace/content/[id]/history` and its authenticated GET API expose only a
whitelist of retained creation/edit/status events, bounded titles, timestamps
and recognized statuses. Authorship is checked before reading audit history.
Moderator identities, notes, IPs, raw details and unrelated audits stay private.
This is status history, not historical copies of publication text.

POST `/api/workspace/content/[id]/restore` locks the current authored content
first, checks an exact observed archived revision and requires a retained
`content.archived_by_author` audit with matching `restoreRevision`. Only new
archives through the author action receive this proof. Legacy/team archives,
later moderation archives and changed versions cannot be restored this way.
Current organization/server rights are rechecked under existing shared locks.
Restoration writes only draft status, clears public time and advances the
version; body, slug, counters and replies remain. Audit and context-owner inbox
notice are transactional; optional push retains existing savepoint isolation.
The client confirms scope, coalesces repeated clicks, validates an exact advancing
draft acknowledgement, refreshes history and requires reload after uncertainty.

Saved people/organization/server follows link to `/workspace/feed?source=...&target=...`.
Existing publication predicates recheck the signed-in user's exact current follow
and public visibility on every request. Cursor context includes the selected
target, filters/forms keep it, and an explicit link returns to all follows of
that type. Unfollowed/hidden targets yield a safe empty state. Product targeting
is unavailable; existing broad feed and commercial visibility rules are unchanged.
RU/EN metadata/messages, noindex, accessible forms and loading/error/recovery
states are included. Six real PostgreSQL fixtures prepare preservation,
audit rollback, archive provenance, revoked rights, exact traversal and follow
privacy; they remain unrun without PostgreSQL. Browser interaction and production
plans still require verification. No table, migration, dependency or workflow is changed.

After integration with eight newer main commits, 295 focused checks across
twenty-one files and touched-file Biome pass. Next webpack compile mode passes;
full production page generation was not run. The already-declared sharp 0.35.4
dependency was installed locally for integration checks without changing its
manifest or lockfile. Root TypeScript retains only the `isSigned` delivery
fixture error. Knip reports three upstream commercial exports:
`packageInspectionLimits`, `storageListSchema`, and
`ResourceReleaseWorkerRepository`; none belong to this block.

Agent A owns this nonunique index contract; retain the existing author index and
verify large-author query plans before claiming scale results:

```sql
CREATE INDEX content_author_publication_updated_id_idx
  ON content (author_id, updated_at DESC, id DESC)
  WHERE type IN ('article','news','devlog','update','announcement','post','question')
    AND status IN ('draft','published','archived');
```


### Private verification evidence updates and searchable applications — 2026-10-11

`/workspace/verification/history` and its authenticated GET API search only the
requester's applications by explanation, feedback or ID, status and type.
Keyset pages fetch 21 rows for 20 summaries, preserve microseconds and original
submission order, bind account/filters and select nearest newer rows without
an anchor lookup. Existing requester and audit target indexes are reused;
large-catalog query plans still require measurement.

Private `/workspace/verification/[id]` and GET/PATCH API expose bounded evidence,
feedback, current/submitted professional-profile comparison and twenty latest
retained submission/update/decision events. Reviewer identities, account fields,
IP addresses, raw audit details and profile fingerprints are excluded. Activity
is retained event history, not historical copies of evidence text.

Authors can replace pending identity, developer or organization evidence using
the observed revision. The transaction locks the own request before checking
current target/organization authority and the professional profile. It replaces
only URL/explanation and writes a mandatory immutable audit identity with a
monotonically ordered timestamp and current profile fingerprint. Submission
date, status, target, badges and commercial scores remain intact. Foreign,
resolved and MTA-control applications cannot use this command. Clients confirm,
coalesce writes, validate exact acknowledgements, ignore late navigation replies
and require reload after uncertain outcomes.

Moderator cards carry the same evidence revision. A stale decision rolls back
before target mutation, resolution audit and inbox notification; amended
applications also reject unversioned legacy moderator commands. Untouched
legacy applications retain the existing decision contract. Independent approval,
live reviewer/target authority, profile matching and MTA ownership checks remain.
New RU/EN pages provide metadata, loading, empty, error and mobile form states.
No table, migration, dependency or workflow changed.

170 focused unit/HTTP/SQL-builder/SSR/interaction checks across 19 files pass.
New verification files pass Biome; existing shared pages/tests retain unrelated
formatting and pass lint. Next webpack compile mode passes; full production
page generation was not run.
Six PostgreSQL fixtures prepare current-profile resubmission, stale-decision
rollback, concurrent commands, mandatory-audit rollback, revoked team authority
and exact bidirectional traversal; they remain unrun without PostgreSQL.
Browser interaction and full production page generation remain to be verified.
Root TypeScript retains only the existing missing `isSigned` delivery fixture;
Knip retains three upstream commercial exports (`packageInspectionLimits`,
`storageListSchema`, `ResourceReleaseWorkerRepository`).

After rebasing on Agent A's resource-copy block, 214 focused checks across
23 files pass, including its copy contracts, HTTP, repository and page regressions.


The additional Next generated-route typecheck exposed optional default page
arguments incompatible with Next's PageProps contract. Thirteen noncommercial
catalog/community/workspace pages now receive the required props object; query
fields remain optional and page behavior is unchanged. Direct SSR fixtures pass
an empty props object where appropriate. The web application's complete
TypeScript check, including generated route types, passes. After this fix,
299 targeted checks across 33 files pass.


### Reviewed team batches and private discussion moderation — 2026-10-11

The existing organization team directory now reviews and saves groups of up to
20 current members: role changes, delegated server access or removal. Preview
tokens bind actor, organization revision, selected identities, complete grants
and the exact command. Organization-first locks recheck every selected member
before one group write; existing per-member audits and access notices commit
with the shared revision. Unrelated commercial permission flags are retained.

Current moderators can search publication discussions, review bounded comments
and same-publication reply context, remove the reviewed full-text version with
a reason, and read retained activity after deletion. Drafts and archived
publications are supported; product comments and unsupported content are excluded.
Live role checks, scoped SHA-256 versions, mandatory audits, retained replies and
preference-aware notices reuse the existing mutation and notification services.
Archived-comment notices link to the author's private discussion workspace.

RU/EN interfaces, metadata, loading/empty/error/success states and private API
responses are implemented without schema changes. Targeted unit, HTTP, SQL-builder,
SSR and interaction checks pass, as do the web TypeScript check, Biome and Next
webpack compile mode. Six PostgreSQL fixtures prepare atomicity, grant preservation,
concurrent confirmation, Unicode full-text hashing and audit rollback; they remain
unrun without a disposable database. Live browser interaction and production
page generation remain outstanding. Root TypeScript still has the upstream
missing `isSigned` delivery fixture; Knip retains three commercial exports.

### Collection-wide resource readiness — 2026-10-11

Collection owners can inspect `/workspace/library/collections/[id]/requirements`
and private, rate-limited GET/JSON-export APIs. One read-only repeatable-read
snapshot binds the collection revision, membership, effective access and chosen
library builds. Root metadata is masked before graph expansion when access,
free publication or safe-build availability is missing. Shared dependencies are
batch-loaded by layer, with the existing 48-node/eight-level limits; withheld
members and truncation block whole-collection readiness and suppress its order.
Archived collections remain inspectable. Membership never grants download rights.

RU/EN screens reuse the single-resource diagnostic body, preserving explicit
publisher/moderator scopes and independent download authorization. No migration,
provider, dependency or workflow changed. 115 focused domain/HTTP/SQL-builder/SSR
checks, changed-file Biome lint and web TypeScript pass. Next webpack compile
mode passes with a 6 GiB Node heap; production generation, real PostgreSQL,
browser interaction and Node 26 remain unverified. The installed environment
has Node 24/pnpm 11 and lacks `@swc/core` and `fast-check`; focused checks use a
scratch Vitest configuration with the same aliases and automatic JSX transform.
Root TypeScript additionally retains the pre-existing missing `isSigned` fixture
in `resource-deliveries.integration.test.ts`. GitHub Actions were not used.

### Reviewed library version batches — 2026-10-12

`/workspace/library/collections/[id]/versions` reviews and confirms up to twenty
existing members. Pinning retains each currently selected safe build; following
latest clears the fixed preference and can recover a withdrawn pin when a safe
latest release exists. Choices affect the whole personal library. Preview binds
actor, collection revision, complete previous/next selections and artifact
identity. The read-committed apply command acquires the existing collection and
per-resource selection advisory locks in stable order, freezes membership,
products, selected preference rows, access sources and target builds, then
rechecks access against the database clock and rebuilds the exact preview.
Guarded upserts, per-resource audits, immutable receipt and mandatory batch audit
commit together. A stale preview rejects the group; a repeated UUID replays the
original receipt without applying changes again. Membership and access grants
are never created by this command. These are library preferences, not installation.

Migration `0068_library_selection_batches` adds owned receipts, request/history
indexes, bounded payload/quota checks and an immutable guard matching committed
selection states and successor revisions. Retained history stores identifiers
and revisions without resource titles, descriptions or storage URLs. History
pages and bounded JSON exports recheck the current collection owner; archiving
prevents new batches but keeps prior operations readable. The RU/EN form freezes
commands after ambiguous outcomes, validates exact acknowledgements and requires
explicit review confirmation. Failed fixed selections can be switched to latest
without silently choosing a replacement during pinning.

130 focused contract/HTTP/SQL-builder/SSR/interaction and neighboring regression
checks pass. Changed-file Biome lint, web TypeScript (including generated routes)
and Next webpack compile mode pass. Drizzle loads all 69 migration entries and
five statements in the new migration; this is not PostgreSQL execution evidence.
Four real PostgreSQL fixtures prepare duplicate concurrency, stale individual
selections, mandatory-audit rollback and revoked-access refusal; they remain
unrun without a disposable database. Browser interaction, production generation
and Node 26 remain unverified. Root TypeScript retains only the previously
reported missing `fast-check` dependency errors and the missing `isSigned`
delivery fixture. No provider, payment, license, dependency or Actions workflow
changed. Focused checks use the previously documented scratch Vitest config
because the installed environment also lacks `@swc/core`.

### Atomic collection membership batches — 2026-10-12

Collection detail/candidate screens now support explicit RU/EN batch confirmation
for up to twenty references on the current page. Commands normalize IDs before
hashing; duplicates, injected scope and oversized arrays are rejected. Owner locks,
optimistic revisions, collection/history quotas and immutable UUID receipts reuse
the existing command protocol. Adding locks all resources and effective grants in
canonical order and rechecks their expiry against database time before any writes;
missing or revoked access cancels the whole batch. Already-present references count
only once toward the 200-member quota. Bulk removal works after access loss or
resource deletion. Membership, one successor revision, one receipt and the mandatory
audit commit together. Downloads and version preferences retain their existing rules.

Migration `0069` expands bounded commands to 8192 bytes and replaces the receipt
guard while retaining prior single-resource commands/receipts. It validates strict
batch shape, unique 1..20 string IDs and the resulting membership for each ID. Client
controls freeze the exact command after first submission, coalesce concurrent clicks
and accept only a complete matching acknowledgement. Private history renders IDs
without looking up current resource metadata. No new entitlement, license, balance,
payment, installation or version selection is created.

Focused verification passes 170 tests across thirteen files. Web TypeScript and
changed-file Biome checks and Next compile pass. Root
TypeScript retains pre-existing missing `fast-check` declarations and the old missing
`isSigned` delivery fixture. Five additional PostgreSQL fixtures cover concurrent
canonical retries, revoked access, mandatory-audit rollback, stale cleanup/archived
replay and malformed receipt guards. Those fixtures and live migration/locking are
unrun here without disposable PostgreSQL; browser interaction and pinned Node 26
validation remain outstanding. GitHub Actions are neither run nor inspected.

### Independent full collection copies — 2026-10-12

Owners can review `/workspace/library/collections/[id]/copy` and create a separately
named active collection from every retained reference in an active or archived
source. The read-only repeatable-read review returns only the source's private label,
state, revision, count and a SHA-256 digest of the full canonical reference set; it
looks up no product metadata or grants. Copy creation uses the existing owner lock,
live account check, source row lock and archive-inclusive 30-collection quota. Under
those locks it rechecks the reviewed revision, state/name, count and exact reference
set before creating the target and inserting all up to 200 references. Target,
membership, immutable receipt and required provenance audit commit together. Source
membership/revision/history is unchanged. Lost-access references remain copyable;
no title, artifact, entitlement, license, payment or version selection is copied.
Version preferences and download authorization retain their library-wide scope.

Migration `0070` replaces only the existing receipt guard. Copy receipts require an
owned distinct source, its exact revision/count and equality of source/target member
sets in both directions; other commands and old receipt replay behavior remain
supported. RU/EN controls require explicit review confirmation, freeze the complete
command after submission and navigate only after validating the new target identity.
Private JSON previews reject filters/paging; recorded history shows source ID,
revision and count without reading the current source. Exact UUID retries replay the
original target receipt after later source or target changes, without another copy.

Focused verification passes 189 tests across thirteen files, changed-file Biome,
web TypeScript and Next compile. Root TypeScript retains pre-existing missing `fast-check` declarations
and the old missing `isSigned` delivery fixture. Five new PostgreSQL fixtures cover
concurrent retries, all 200 archived/lost-access references and independent edits,
stale reviews/committed replay, required-audit rollback and foreign-source/partial-copy
guards. They remain unrun without disposable PostgreSQL. Live migration/locking,
browser interaction and pinned Node 26 validation remain outstanding. GitHub Actions
are neither run nor inspected.

### Collection release overview and shared safe projections — 2026-10-12

`/workspace/library/collections/[id]/releases` compares selected fixed builds with
latest safe published builds. RU/EN controls offer strict all/updates/pinned/unavailable
filters, literal accessible-name search, twenty-row pagination, exact selected-build
downloads, individual version recovery and navigation to reviewed batch controls.
Counts follow the search; pinned overlaps update/unavailable categories. The full
collection reference count is reported separately. Search/filter/page are retained
in pagination and private JSON exports; clearing search preserves only the filter.
Archived collections remain readable but do not offer group mutation navigation.

A shared release projection serves the general library and collection overview.
Collection ownership and the live account are checked before release queries. A
read-only repeatable-read transaction binds collection revision, full reference
count, grants, preferences, safe artifacts, filtered counts/items and the database
timestamp. Expiry now uses `transaction_timestamp()` in both release projections.
Collection references are left-joined with effective rights: revoked/deleted entries
remain unavailable, with title/slug/build IDs/versions masked. A withdrawn fixed
selection with an available clean replacement is `selection_unavailable`, never an
automatic download fallback. Build comparisons use identities, not version labels.
Membership, rights, preferences, payments, receipts and artifact state are not changed.

Private authenticated API/export routes reuse inspection rate limits, no-store and
cookie variance. Filters/duplicates/scope injection are rejected; exports are bounded
to 512 KiB with JSON attachment/nosniff headers. Five bounded SQL queries serve each
collection page regardless of its item count; no per-item service fetches are added.
Existing collection and publication indexes are reused; no schema/migration is added.

Focused verification passes 239 tests across fifteen files, changed-file Biome and
web TypeScript and Next compile. Root TypeScript retains
pre-existing missing `fast-check` declarations and the old missing `isSigned` delivery
fixture. Three PostgreSQL fixtures cover identity-based updates/withdrawn pins,
revoked-reference masking/search and archive/foreign-staff inspection. They remain
unrun without disposable PostgreSQL; actual SQL/query plans, browser interaction and
pinned Node 26 validation remain open. GitHub Actions are neither run nor inspected.

### Private individual and group selection history — 2026-10-12

`/workspace/library/version-history` projects the current buyer's own
`library.release_selected` actions from both individual and reviewed group commands.
RU/EN navigation from release/version screens, strict resource/7/30/90/365-day filters,
twenty-row pages and bounded private JSON exports make recorded choices inspectable.
No new action, preference change, restoration, receipt, license or grant is created.
Recorded latest choices have no historical build identity; the interface displays only
the recorded mode/revision. Fixed choices retain their recorded opaque build ID.
Current resource labels are explicitly identified as current metadata.

A live account and actor/type/action/target scope precede history reads. One read-only
repeatable-read snapshot binds database time, the closed period, counts, selected
records and effective publication/access metadata. Recorded IDs remain inspectable
after rights loss or resource deletion; title/slug/release labels and management links
require current access and safe publication. Raw audits are never returned: SQL selects
only four recorded detail fields and the domain parser exposes mode/build/revision and
an origin label. IPs, user agents, batch receipt IDs and unknown private fields are not
exported. Malformed historical details retain a neutral entry without inferred changes.

Migration `0071` adds a partial actor/time/ID index for these actions. Its trusted
predicate is literal SQL so generic prepared plans can use it. Existing audit retention
is unchanged. Four bounded queries read each page, with resource metadata joined only
after limiting the recorded events. Authenticated API/export routes reuse inspection
rate limits, private/no-store/Cookie variance and 512-KiB attachment/nosniff controls.

Focused verification passes 260 tests across nineteen files, web TypeScript,
changed-file Biome and Next compile. Root TypeScript retains pre-existing missing `fast-check`
declarations and the old missing `isSigned` delivery fixture. Three PostgreSQL fixtures
cover combined individual/group history and revocation, foreign staff isolation and
malformed-audit privacy. They remain unrun without disposable PostgreSQL; live migration,
query-plan/locking checks, browser interaction and pinned Node 26 validation remain open.
GitHub Actions are neither run nor inspected.


### Reviewed report batches and server publication recovery — 2026-10-12

The private discussion report workspace now previews and confirms decisions on
up to 20 explicitly selected pending cases. Review, resolution and dismissal
reuse the existing report service; deletion remains an individually reviewed
comment command. Scope-bound previews cover the complete comment text and report
state, current publication context, moderator identity, action and notes. Writers
recheck live roles and lock the publication, comment and selected reports in a
stable order before one bounded update and a mandatory audit for every case.
Unselected reports, discussion replies and counters are retained. Reporter status
notifications use the existing preference-aware, bounded best-effort dispatcher
once after the committed batch; their delivery is not part of report atomicity.

Server editorial workspaces link to private publication history and recover proven
server-editor archives as drafts. History uses bounded, versioned cursor pages
and narrow public team identities; reviewer identities and audit details stay
private. Restoration reuses the author publication repository, rechecks current
server/team grants under locks, validates the observed revision and retained
archive proof, and records its audit and inbox notices in the same transaction.
Legacy archives without proof and later moderator archives remain protected.
Original author, text, slug and discussion survive restoration. Notices follow
the server's current team/owner, including after transfer to personal ownership.
Organization and server history screens share one implementation and retain RU/EN,
loading, empty, safe error, confirmation and mobile states. No schema, migration,
dependency, commercial contract or workflow changed.

714 focused unit/HTTP/SQL-builder/SSR/interaction checks across 59 files pass,
including organization, discussion, publication, resource-copy and subscription
regressions. Web TypeScript including generated routes, Biome, diff checks and
Next webpack compile mode pass. Root TypeScript retains only the upstream missing
`isSigned` resource-delivery fixture; Knip retains its three commercial exports.
Six additional PostgreSQL fixtures prepare selected-case atomicity, complete
Unicode text changes, concurrent confirmations/restores, revoked delegation,
moderator protection and mandatory-audit rollback; they remain unrun without a
disposable database. Live browser interaction and production page generation
remain to be verified.

After rebasing on Agent A's seven library blocks, 953 focused checks across
80 files pass. All 109 upstream source/schema/migration/test files and the full
upstream problem notes are preserved. The integrated web compile and type checks
pass; the existing root fixture and three unused commercial exports remain.


### Reviewed server visibility batches and private activity filters — 2026-10-12

Managed server pages now select up to 20 current personal/organization listings,
preview visibility and explicitly confirm the reviewed group. Scope-bound versions
cover listing revisions, displayed states and locked live grants. Selected listings
lock in ID order; one account read and one read per required authority table protect
both the batch and existing single listing/editorial writes. A revoked platform
administrator cannot retain access through a stale session role. Changed listings
receive one bounded update and a mandatory audit per edit in the same transaction;
already-matching listings retain their revisions without a fabricated edit event.
Endpoints, endpoint revisions, ownership, listing status and observations remain.

Existing server activity now has RU/EN period and event-group filters, recorded
visibility transitions and private twenty-event JSON page exports. Actor labels and
public profile identities retain attribution without exporting internal actor IDs,
raw audit details, IPs, agents or proof tokens. Cursor context binds actor, server
and filters; SQL anchors and a retained database-clock cutoff preserve microsecond
ordering and page windows. Legacy unfiltered anchors remain supported. Export
uses the reviewed cutoff and independently checks current authority. Missing grants,
malformed/repeated filters and storage failures have safe, distinct boundaries.
Localized metadata, loading/empty/error/success states and mobile controls use the
existing design system. No schema, migration, dependency, commercial contract or
workflow changed.

1640 focused unit/HTTP/SQL-builder/SSR/interaction checks across 148 files pass.
Four final history files pass again after preserving full microsecond timestamps
in API/export projections. Seven old server-control failures were reproduced on an
unchanged HEAD export and fixed by accounting for the existing read-only evidence
lookup in their fixtures; authority and outcome assertions remain intact.
Web TypeScript including generated routes, Next webpack compile mode, Biome and
diff checks pass. Root TypeScript retains the upstream missing `isSigned` resource
fixture; Knip retains only the three upstream commercial exports.
Six new PostgreSQL fixtures prepare selected-case atomicity, no-op preservation,
independent telemetry, concurrent confirmation, revoked grants/stale admin roles,
mandatory-audit rollback and tied microsecond traversal; they remain unrun without
a disposable database. Browser interaction and production page generation remain
outstanding. Existing PostgreSQL activity fixtures now seed and revoke a real
administrator role rather than relying on a supplied role string.

### Private buyer release comparison — 2026-10-12

Version screens now link the current selected safe build to another safe published
release at `/workspace/library/[id]/versions/compare`. Exact from/to IDs and the bounded
return page are validated; swapping reverses the comparison and exports preserve the
same pair. RU/EN tables/cards display archive SHA-256/size/name/MIME, publication time,
notes, declared MTA target/signing flag and only the existing public package summary.
No preference, entitlement, receipt, license, payment or artifact state is changed;
comparison has no download or selection mutation controls. Labels make no assumptions
about semantic version ordering, runtime compatibility or changed internal files.

A live account, effective grants/legacy licenses at database time, published product
and both same-product trusted-clean published builds are required. Four bounded queries
run in one read-only repeatable-read snapshot. Missing, withdrawn or foreign releases
cancel the entire comparison; publisher/staff roles confer no buyer-access bypass.
Outputs whitelist release fields: inventory paths, ACL/dependency declarations, full
package evidence, storage keys and private moderation/audit data are excluded. Package
summaries require the v1 inspector and matching artifact hash/size; malformed summary
counts or absent evidence yield unknown instead of inferred zero/unchanged state.
Equal archive hashes with unequal sizes are reported as inconsistent observations.
Notes are capped at 10000 characters with an explicit truncation flag; exact stored
metadata differences remain separately recorded. Package count differences are summary
observations and do not identify changed files or certify execution/DRM.

Authenticated private API/export routes reuse inspection limits, no-store/Cookie variance,
512-KiB JSON attachment bounds and nosniff. Existing build/access indexes are reused;
no migration/schema change is included. Focused verification passes 275 tests across
23 files; changed-file Biome, web TypeScript and isolated Next compile pass.
Root TypeScript retains pre-existing missing `fast-check` declarations
and the old missing `isSigned` delivery fixture. Three PostgreSQL fixtures cover exact
artifact comparison/public-summary privacy, revoked/withdrawn/foreign releases and
publisher/staff access isolation. They remain unrun without disposable PostgreSQL;
live query/locking, browser interaction and pinned Node 26 validation remain open.
GitHub Actions are neither run nor inspected.

The merged build worker was killed under the environment's 8-GiB memory limit.
Next's supported Webpack memory optimizations are now enabled and route collection
uses two workers. These are build settings, with no application authorization or
runtime route changes. The merged tree is recompiled separately from test workers;
GitHub Actions remain untouched. Both concurrent server/community commits are
preserved; the only rebase conflict was independent documentation append operations.


## Individual library selection recovery (2026-10-12)

A lost or malformed selection response previously allowed a different choice with the
same displayed revision even though the first command might have committed. Controls
now freeze mode/build/revision before sending, coalesce pending clicks, disable other
choices and offer an exact retry or full state reload. Definitive 400/401/403/404/409
responses require reloading; rate limits, server errors and lost acknowledgements keep
the original request. This is preference-state replay under the existing revision
contract, not a new immutable command receipt. A later intervening change conflicts.
Acknowledgements require the exact resource, selection fields, canonical timestamp
(or the untouched latest revision-zero state), requested mode/build and current or next
revision. Selection POST rejects query parameters as well as extra command fields.

The repository independently validates the strict command, reads clock_timestamp after
all selection/build locks, rechecks expiry and derives monotonic timestamps from that
observation. Upserts guard an existing revision; when no preference was observed, an
unexpected conflicting insert is rejected instead of overwriting it. Mandatory audit
and selection remain in the same transaction. No schema migration is required.

Focused interaction/contract/repository/HTTP/page checks cover both locales, exact
retries, duplicate clicks, malformed acknowledgements, definitive/retryable errors,
clock skew after blocking locks, unknown database time, revision and insert races.
Three disposable-PostgreSQL fixtures cover single replay/audit uniqueness, competing
revision-zero commands and rollback on audit failure; these remain unrun in this
environment. Live PostgreSQL locking, browser interaction and Node 26 validation remain
open. GitHub Actions are neither run nor inspected.

Verification: 163 focused tests across 14 files pass; changed-file Biome, web TypeScript
and Next compile pass (44s compilation, two page workers). Root TypeScript reports only
existing missing fast-check types and the old isSigned delivery fixture omission.


### Discussion subscriptions and saved reply navigation — 2026-10-12

Public editorial discussions now use the existing desired-state follow API and
private saved workspace. Readers subscribe/unsubscribe on article pages, filter
and search saved discussions, see reply counts and open the latest comment with
its focused permalink. Public-target join predicates mask archived/deleted
publication metadata while retaining a removable private subscription key.
RU/EN controls, authentication boundaries, checking/retry/pending/success states,
notifications settings descriptions and keyboard/mobile controls are connected.
Uncertain write acknowledgements block another write until state is reread.

New replies dispatch once to distinct current publication/parent participants
and event-time subscribers, excluding the writer. Fifty-recipient cursor pages,
exact PostgreSQL microseconds, a database-clock event cutoff and ten concurrent
transactions bound work without a one-hundred-follower delivery cap. Delivery
rechecks current public content/comment and subscription under locks, serializes
unsubscribe and preference changes, and applies separate follow/content flags.
Deterministic recipient/event inbox IDs retain read state and avoid duplicate
push jobs on replay. Generic localized notices carry a focused link without
copying comment text, publication body/title or private author metadata. Existing
notification/outbox semantics for other categories and product reviews remain.
A delivery/registration failure cannot turn a saved comment into a retry.

Reply fanout remains best effort after the saved HTTP response; only notifications
already inserted have durable push outbox jobs. Process interruption or individual
storage failures have no durable fanout checkpoint/retry worker. The exact Agent A
index contract is `follows_target_created_id_idx ON follows(target_type, target_id,
created_at, id)` for large event-time audiences; this block creates no schema or
migration and currently awaits that index. No new dependency or workflow changed.

449 focused unit/HTTP/SQL-builder/SSR/interaction checks across 38 files pass.
Web TypeScript including generated routes, Next webpack compile mode, changed-file
Biome (lint-only for three minimally edited pre-existing unformatted shared files),
and diff checks pass. Root TypeScript retains only the
upstream missing `isSigned` resource-delivery fixture; Knip retains three upstream
commercial exports. Six PostgreSQL fixtures prepare concurrent idempotence,
archive masking, event-time consent, distinct recipients/preferences, replay/read
state and unsubscribe/archive serialization; they remain unrun without disposable
PostgreSQL. Browser interaction and production page generation remain outstanding.

After rebasing on Agent A's release comparison and selection recovery, 543 checks
across 46 files pass. All 28 upstream files and complete problem notes are preserved.
The follow domain type includes editorial content without changing stored schema.


## Reviewed version choice from release comparison (2026-10-12)

The comparison screen now offers an explicit target-release choice, superseding the
initial comparison-only interface. The read-only comparison snapshot includes the
actor's current selection revision/mode/build ID via an actor-scoped left join in the
existing owned-product query. Product fields remain explicitly projected; no extra
query, schema migration or write is needed to compare/export.

RU/EN controls show the target version/hash/byte size and require acknowledgement before
submitting a fixed choice. A reviewed fixed command optionally carries a strict
reviewedArtifact (lowercase SHA-256, positive safe-integer bytes); latest mode rejects
that field. The repository rechecks identity on the exact same-product published clean
build under a share lock before checking selection revision, final database-time access
and writing the preference/audit. Changed identity yields LIBRARY_RELEASE_REVIEW_CHANGED;
an intervening preference change conflicts. Existing unreviewed version controls and
batch commands keep their contracts. Preference replay is still state/revision based,
with no immutable single-command receipt or implied installation, compatibility, access,
DRM, entitlement, payment or license change.

Both single-choice surfaces share request locking, frozen-command retries, strict
acknowledgement and reload/error handling. The comparison control is keyed to resource,
revision and target archive identity to reset review state after a new snapshot. An
already fixed target displays its state without another confirmation. Missing access,
unsafe/withdrawn targets and stale/changed reviewed identities never substitute a newer
release. Two PostgreSQL fixtures cover compare->choose->replay->updated snapshot and
intervening-choice/revoked-access rejection; these remain unrun without a disposable
PostgreSQL instance. Browser interaction and Node 26 validation remain open. The concurrent
discussion-watch commit dded0df is preserved. GitHub Actions are neither run nor inspected.

Verification: 225 focused tests across 19 files pass, including individual recovery,
comparison selection, selection batches and the preserved discussion-watch checks.
Changed-file Biome, web TypeScript and the merged Next compile pass. Root TypeScript
retains only the existing fast-check type errors and old missing isSigned fixture.


## Exact-release buyer preparation previews (2026-10-12)

Comparison cards now link each exact release into library preparation using previewBuildId.
The bounded, strictly parsed query optionally preserves returnFrom/returnPage; rechecking
MTA keeps hidden preview/navigation fields, private JSON export uses the same query, and
the return link restores the pair with the inspected release as comparison target. Navigation
fields never reach repository authority decisions. Publisher/moderator buildId remains a
separate contract; those routes reject buyer preview fields, and library routes still reject
privileged buildId. Direct repository calls validate preview IDs and scope before querying.

The override affects only the root's chosen ID and preview label, not the publication/clean
scan predicates or any dependency choice. Root access, publication, same-product exact build
and trusted clean scan are mandatory; withdrawn, foreign or unsafe candidates fail without
latest substitution. Dependencies use the buyer's own current pins/latest preferences and
existing public-catalog traversal rules (48 nodes / 8 levels). Catalog declarations remain
current product metadata, not a claim about an earlier archive's dependency declarations.
Report JSON explicitly identifies previewBuildId (null for ordinary reports).

Single library reports now run read-only repeatable-read with transaction_timestamp in
access-source SQL, replacing application-clock reads and unnecessary product/user share
locks. Publisher/moderator authority locks remain. Preview inspection does not write
preferences, audits, receipts, grants, licenses or payments and suppresses report download
controls; normal preparation/download behavior remains. Downloads always recheck rights
separately. RU/EN notes distinguish preview, installation and current dependency choices.

Two PostgreSQL fixtures cover a candidate root with unchanged fixed dependency preferences
and audits, and foreign/withdrawn/revoked-access rejection. They remain unrun without a
disposable PostgreSQL instance. Live query plans, PostgreSQL execution, browser interaction
and Node 26 validation remain open. No migration is needed; existing indexes are reused.
GitHub Actions are neither run nor inspected.

Verification: 109 focused checks across preparation, collection readiness and comparison
surfaces pass. Changed-file Biome, web TypeScript and Next compile pass. Root TypeScript
retains only pre-existing missing fast-check types and the old missing isSigned delivery
fixture. PostgreSQL/browser checks remain explicitly unrun.


### Private profile journals and filtered organization activity — 2026-10-12

`/settings/history` now shows retained profile, professional and privacy edit
operations, with event-group and all/7/30/90/365-day filters, twenty-row keyset
pages, verification-invalidation context and a private JSON page export. Settings,
professional and privacy editors link to the journal. Existing edit repositories
already record these operations; no replacement storage or new migration is used.
The projection returns allowlisted field names, not changed values, account
contacts, networking data or raw audit details. Recorded save operations do not
prove every listed field changed. Malformed historical field/verification details
remain neutral; professional verification flags require the exact recorded boolean.

Organization activity now filters profile/team/ownership events and searches
current public author/subject names with literal wildcard escaping. Current owner
or administrator grants are rechecked for reads and exports. Former staff and
stale owner memberships retain no journal access. Existing unfiltered `before`
links and the legacy repository response remain supported. Both journals bind
new versioned cursors to account, target and filters, retain a database-clock
cutoff and exact PostgreSQL microseconds, resolve anchors within that scope and
reject deleted, foreign, changed-filter or future windows instead of shifting pages.
Read-only repeatable-read snapshots use the existing target/time/ID audit index.
Current-name search results can change after renames or account deletion; the
cutoff fixes recorded event time rather than retaining a cross-request snapshot.

RU/EN metadata, errors, accessible native filter forms, localized loading, empty
states, recovery links and mobile layouts reuse existing components. Exports
reuse authenticated, rate-limited reads, retain the reviewed filters/cutoff and
provide private/no-store/Cookie headers, nosniff and a 512-KiB attachment bound.
Exports contain the displayed page, not an unbounded audit archive. No commerce
contract, schema, dependency or workflow changed.

411 focused unit/HTTP/SQL-builder/SSR checks across 38 files pass, including profile,
team governance, verification, editorial, discussion subscription and localization
regressions. Web TypeScript including generated routes, Next webpack compile mode,
changed-file Biome (lint-only for five minimally edited pre-existing shared files)
and diff checks pass. Root TypeScript retains only the upstream `isSigned` delivery
fixture omission; Knip retains three upstream commercial exports. Six PostgreSQL
fixtures prepare actual persisted edits, malformed-evidence privacy, tied timestamp
traversal, retained cutoffs/deleted anchors, escaped team searches and revoked
manager access. They remain unrun without disposable PostgreSQL; browser behavior,
live query plans and production page generation remain outstanding. GitHub Actions
are neither run nor inspected.

After rebasing on Agent A's reviewed comparison selections and preparation preview,
557 checks across 48 files pass. All 29 upstream files and complete problem notes
are preserved. The integrated web type checks and webpack compile pass; the known
root fixture omission and three unused commercial exports remain.


## Release-watch search, export and reviewed bulk stop (2026-10-12)

The private watch center now supports literal title search (100 characters), filter/count
pagination capped at 1000 pages, and a bounded twenty-row JSON export. Availability uses
transaction_timestamp in the existing read-only repeatable-read snapshot. Search predicates
require current own access and safe publication before matching titles, preventing unavailable
metadata from affecting search results. Titles are clipped to 200 characters in SQL and masked
again at the screen/export boundary. Export whitelists watch fields, counts and bounds, excluding
account IDs, cursor values, storage/audit data and raw extras; it retains inspection rate limits,
private no-store/Cookie variance, attachment/nosniff and a 512-KiB size limit.

RU/EN bulk controls select up to 20 enabled watches on the displayed page and require explicit
acknowledgement. The strict command carries only unique product IDs and expected revisions,
canonicalized by ASCII ID order; clients cannot enable watches, choose another account, change
worker cursors or send authority fields. The repository validates independently, shares the
account enrollment advisory lock with single-watch commands, requires a live account and locks
all owned watch rows before deciding. No current resource grant is required to stop one's own
watch. All exact enabled revisions are disabled in one guarded JSON-recordset UPDATE, with a
mandatory batch audit in the same transaction. Database time produces monotonic update timestamps.
Cursor values, existing notices, resource/version preferences, rights, licenses and payments
remain untouched. Workers observe row locking and existing notices are not recalled.

An all-disabled exact successor state returns changedCount=0 without another audit; mixed
current/successor states and intervening changes conflict rather than partially applying.
This confirms preference state, not an immutable UUID receipt or attribution of prior disable
operations. Frozen-command retries, strict complete acknowledgements and definitive-error
reload preserve the reviewed set after uncertain responses. Existing single enrollment and
notification delivery contracts remain. No migration or worker scheduling is included.

Two disposable-PostgreSQL fixtures cover stopping two own watches after access loss while
preserving cursors/notices and exact retry audit uniqueness, plus rollback on mandatory audit
failure. They remain unrun without PostgreSQL; live locks/query plans, browser interaction and
Node 26 validation remain open. Concurrent profile/team-history commit 1c204b6 is preserved.
GitHub Actions are neither run nor inspected.

Verification: 150 focused tests across 14 files pass, covering watches/worker/batch flows
and the preserved profile/team-history slice. Changed-file Biome, web TypeScript and
merged Next compile pass. Root TypeScript retains only the existing fast-check type
errors and old missing isSigned fixture. PostgreSQL/browser checks remain unrun.


## Reviewed collection release-watch enrollment (2026-10-12)

Private collection detail and release pages now link to a dedicated RU/EN watch screen.
Its bounded twenty-row search/filter view reads live owner/collection membership, own watch
state and account-wide active count in one read-only repeatable-read database-time snapshot.
Unavailable reference titles are masked; title search only matches available safe publications.
Archived collections can be inspected, but cannot enroll watches. New references start at
watch revision zero. Existing enabled watches are displayed without being re-enrolled.

The shared batch controller now has a collection-enrollment mode with explicit confirmation,
remaining-quota/20-item limits, frozen collection/watch revisions, strict enabled-state
acknowledgement, precise retries and definitive-error reload. Global batch stopping retains
its existing disabled-state contract. The strict collection command includes only a reviewed
collection revision plus unique, canonically sorted product/watch revisions; current session
and route determine the owner/collection. No client cursor, arbitrary scope or account input
is accepted. Existing private HTTP transport/rate/body limits apply.

Apply acquires the existing collection-owner lock, then the account watch-enrollment lock,
checks active ownership/current revision, locks exact selected memberships/products/grant or
legacy-license sources/safe published builds/watch rows, and checks expiry again at database
time after waiting. Mixed watch states, changed membership, lost rights, withdrawn builds or
a 100-watch quota overflow abort the whole batch. One guarded JSON-recordset upsert begins
new/re-enabled watches after each resource's latest committed event while preserving monotonic
existing cursor/timestamp state, then writes a required collection batch audit atomically.
No version preferences, collection membership, entitlements, licenses or payments are changed.
Old events are not backfilled; existing notice delivery/preferences remain separate gates.

All exact enabled successor states return changedCount=0 without another enrollment/audit;
this is state confirmation rather than an immutable UUID receipt. Current collection revision,
access and safety are still required when confirming retries. No migration or worker scheduling
is introduced. Existing membership, user/watch-time and resource-event indexes are reused.
Two PostgreSQL fixtures cover baseline enrollment with preserved pins/exact retry uniqueness,
and audit rollback/revoked access/stale membership rejection; they remain unrun without a
disposable PostgreSQL instance. Live locks/query plans, browser interaction and Node 26
validation remain open. GitHub Actions are neither run nor inspected.

The shared access-source lock accepts an optional SQL time expression; only the new
collection-enrollment caller requests clock_timestamp for initial source selection.
Other callers retain the default application-time policy, with no unbounded read change.

Verification: 187 focused tests across 19 files pass, covering collection enrollment,
individual/batch watches, workers, collection pages and existing selection/access flows.
Changed-file Biome and web TypeScript pass. The first Next compile was killed by the
8-GiB environment limit; an isolated retry with a 3-GiB heap compiled successfully in
25.8s and exited zero. Full production generation and live PostgreSQL/browser checks
remain unrun. Root TypeScript retains only existing missing fast-check types and the
old missing isSigned delivery fixture.


## Private release-watch command history (2026-10-12)

Own watch history now projects individual preference changes, group stops and collection
enrollment as twenty-operation pages. RU/EN filters cover 7/30/90/365 days, operation source
and an optional recorded resource ID. Matching a resource retains the complete matching
operation (at most twenty changes) for group context. Current accessible titles/watch state
are shown separately from recorded enabled/revision state. History does not restore settings,
claim delivery, recall notices, grant files or mutate preferences. Worker delivery/automatic
stop logs remain separate; only the current user's recorded preference commands are included.

The read-only repeatable-read repository checks a live account and database-time window,
then restricts actor ID/type, known command actions and expected target types. User-targeted
stop events must target that same user. Current metadata for at most 400 unique recorded IDs
is fetched in one own-access/safe-publication/watch lookup, without per-change queries. Lost
rights mask current names/management links while retaining the user's recorded reference IDs
and own current watch state. Historical collection IDs/revisions are recorded provenance,
with no current foreign collection names or authority implied.

SQL projects only bounded boolean/numeric fields and arrays of at most twenty capped IDs;
invalid arrays are not silently truncated into valid operations. Domain parsing requires
unique valid IDs, positive integer revisions, exact change counts and a verified collection
revision for enrollment. Malformed evidence yields an unknown operation with no invented
changes. Raw audit fields, IP/user-agent data, cursors, storage/build evidence and private
extras never enter the report. Private API/export retains inspection limiting, no-store/Cookie
variance, attachment/nosniff and a 512-KiB limit. Migration 0072 adds an actor/time/id partial
index with the same literal user/action predicate used by prepared reader queries; no stored
commands or worker behavior are changed.

Two PostgreSQL fixtures cover enrollment/stop history with resource-filter group context,
revoked-rights name masking and other-actor isolation, plus malformed raw-field privacy.
They remain unrun without a disposable PostgreSQL instance. Live migrations/query plans,
browser interaction, full production generation and Node 26 validation remain open.
GitHub Actions are neither run nor inspected.

Release-watch command-history validation: 129 tests across 22 focused files passed;
lint passed for all 18 touched TypeScript sources, and web TypeScript passed again
after Next generated route types. Next webpack compile-mode build exited successfully
with its route summary. Full production generation remains unverified. Root TypeScript
still reports the previously recorded fast-check/implicit-any and delivery-fixture
errors; the new PostgreSQL history fixtures remain unrun.


## Private support message discovery and fresh read permissions (Agent B)

`/support/[id]/messages` and `/admin/support/[id]/messages` now search the actual
private conversation by literal text and recorded requester/staff role. Native
GET forms retain shareable filters, and existing thread headers/messages link to
the explorer and focused message permalinks. Focused old messages are highlighted
and can be followed in both chronological directions. Twenty-message keyset pages
retain a database-clock cutoff, exact PostgreSQL microseconds and an actor/case/
filter context; foreign, removed, changed-filter and future anchors fail explicitly.
The page uses the existing case/time/ID index, bounded projections and scoped
EXISTS checks instead of whole-thread counts or offset scans. The cutoff excludes
subsequent ordinary replies; it is not a persistent cross-request MVCC snapshot.

`/api/support/[id]/messages` and `/export` authenticate, apply search limits and
recheck live requester/staff authority inside a read-only repeatable-read
transaction. The staff page additionally requires a current staff role, including
when the viewer owns the case. The private JSON download contains the selected
page and preserved filter window, not the complete conversation. It retains
private/no-store/Cookie headers, request IDs, nosniff, a fixed filename and the
shared 512-KiB bound. New projections exclude staff/account identities, linked
commercial context and networking/audit data. Legacy oversized text is bounded
in SQL and again at the UTF-16 contract boundary without splitting a surrogate
pair, with an explicit truncation label. The service rejects inconsistent case,
focus or retained cutoff results instead of accepting a misleading success.

The existing `/api/support/[id]` GET now delegates to `authorizedThread`, resolving
the current database role and case before reading messages. Authorization, count
and the compatible 100-message offset page share one read snapshot. Revoked
moderators can no longer rely on a stale session claim to read another user's
thread. Duplicate/malformed message-page parameters fail before storage and
private reads are rate-limited. Existing reply/status/idempotency and linked
commerce contracts remain intact. Thread author labels use actual requester
capability rather than the page's navigation mode. No schema, migration,
dependency, workflow or commerce implementation changed.

RU/EN metadata, errors, loading/empty/recovery states, native labeled controls,
escaped text, focused anchors and mobile layouts reuse the existing design system.
445 focused checks across 33 unit/HTTP/SQL-builder/SSR files pass, covering support,
private edit journals, team governance, profile privacy and discussion subscriptions.
Web TypeScript and changed-file Biome/diff checks pass. Root TypeScript retains
only the upstream resource-delivery fixture's missing `isSigned`; Knip retains
three upstream commercial exports. Four PostgreSQL fixtures prepare persisted
45-row tied-timestamp traversal, forward/backward retained windows, new replies,
literal wildcard searches, exact focused links, revoked staff, scoped/deleted
anchors and legacy Unicode bounds. These fixtures remain unrun without disposable
PostgreSQL. Browser behavior, live query plans and production page generation
remain outstanding. GitHub Actions are neither run nor inspected.

The completed Next webpack compile-mode build also passes with the new support
routes; generated-route TypeScript is rechecked after integration.

After rebasing on Agent A's release-watch search/export/stop batches, collection
enrollment and private command history, 553 checks across 51 files pass. All 51
upstream paths are retained byte-for-byte except the shared domain export barrel
and problem notes, whose complete upstream content remains a prefix. The integrated
webpack compile-mode build exits successfully, web TypeScript including generated
routes and changed-file Biome/diff checks pass. The known root fixture omission
and three unused commercial exports remain. No PostgreSQL fixture or Actions ran.


## Release-watch command and worker reliability (2026-10-12)

Individual commands now validate the strict schema at the repository boundary, set
bounded transaction lock/statement waits, and use database time for source selection
and final finite-access checks after all rights/build/watch locks. Enrollment replays
also require still-current access. Unexpected insert conflicts cannot overwrite a
new watch; existing upserts compare the held revision/state and preserve monotonic
cursor/time values. Required audit failures still roll back the whole command.
Single-watch reads and writes reject arbitrary query selectors.

Release workers select rights with clock_timestamp and read database time after the
notification-preference lock. Expiry while waiting prevents inbox/push creation and
stops the watch; invalid clocks fail closed. Guarded progress writes compare enabled
state, revision and exact old cursor, and keep update time monotonic. A missing write
aborts the transaction, including authoritative inbox/outbox changes; no processing
audit is falsely committed. Existing publication, preference, worker batch limits,
shutdown checks and skip-locked scope behavior are preserved.

Individual RU/EN controls now freeze the reviewed resource, revision, desired state
and prior update time. An uncertain result offers only the same command retry or
reload; a successful acknowledgement must match the exact successor state and a
valid canonical, increasing timestamp. Definitive failures require reload. Both
individual and grouped controllers suppress stale duplicate handlers after success
or rejection, abort requests on unmount and ignore late results. Group retries also
freeze their collection/global endpoint and acknowledgement mode.

Two additional PostgreSQL fixtures cover finite rights despite application clock
skew, and single-command audit rollback/monotonic timestamp/exact replay. They remain
unrun without a disposable PostgreSQL instance. Browser interaction, live locking,
full production generation and Node 26 validation remain open. No new migration is
introduced; GitHub Actions are neither run nor inspected.

Verification: 132 focused tests across 19 files pass, covering individual/group
interaction, repository/worker/HTTP behavior and preserved collection/history flows.
Biome lint passes for all 12 touched TypeScript sources; web TypeScript also passes
after Next regenerated route types. The isolated Next webpack compile-mode build
exits zero with its route summary. Root TypeScript retains only the known missing
fast-check/implicit-any and old missing isSigned delivery-fixture errors. Live
PostgreSQL fixtures and browser checks remain unrun.


Integration of approved release-watch commit ffea46a with support-discovery commit
91c9f45 preserves both commits and every approved source file unchanged. Only the
append-only documentation conflict was combined. On the merged tree, 243 tests
across 25 focused files (watch/history/collection/support discovery and support API)
pass. Web TypeScript passes after route regeneration, and Next webpack compile-mode
build exits zero with its route summary. Live PostgreSQL/browser and full production
generation remain unverified. GitHub Actions were neither run nor inspected.


## Community report search and scoped decision receipts (Agent B)

Both `/workspace/reports` and `/admin/reports` now search literal report text or
report IDs with an 80-character bound, escaped SQL wildcards and retained
category/target/view/page filters. Search stays inside requester or current staff
scope and preserves the existing queue ordering and bounded page contract.
Native search forms reset to page one; pagination and view links retain the query.
SSR now uses the same strict query parser as the API: duplicate, unknown or
malformed filters show an explicit recovery state rather than silently changing
the reviewed scope. Existing reason projections are capped in PostgreSQL.

`/workspace/reports/[id]/history` and `/admin/reports/[id]/history` show persisted
submission/review/decision events from existing audit records. Report cards link
to the history. All/7/30/90/365-day and event-group filters, twenty-row keyset
pages, database-clock cutoffs, scoped anchors and exact PostgreSQL microseconds
reuse private-history infrastructure and the existing target/time/ID audit index.
Cursors bind actor, report, audience and filters; reuse across staff/requester
views, changed filters, future windows or deleted anchors fails explicitly. The
cutoff fixes event time rather than maintaining a cross-request MVCC snapshot.
The displayed report status remains current; historical transitions reflect
recorded evidence and malformed legacy evidence stays neutral.

Requester receipts expose only recorded steps, role labels, validated status
transitions and strict recorded removal evidence. Staff notes and batch details
are not selected from PostgreSQL for requester reads. No account identities,
report target IDs, private reporter text/evidence, IP/user-agent fields or raw
audit details enter either receipt. Staff receipts require a freshly read
moderator/admin role and may include bounded decision notes and validated
1–20-report batch context. Oversized legacy notes are capped in SQL and UTF-16
without splitting surrogate pairs. Existing community-target and requester scope
checks are reused; commercial product/server/license targets remain unavailable.

Four private read/export routes under `/api/workspace/reports/[id]/history` and
`/api/admin/reports/[id]/history` authenticate, limit searches and resolve access
again for each read/export in a read-only repeatable-read transaction. Exports
contain the displayed page and retained window, with private/no-store/Cookie
headers, request IDs, nosniff, fixed filenames and the shared 512-KiB bound. The
service rejects inconsistent audience/report/filter/cutoff output and narrows
cursor fields before encoding them. RU/EN metadata, errors, loading/empty states,
native labeled forms, escaped notes and responsive views use existing components.
No schema, migration, dependency, workflow or commercial contract changed.

717 unit/HTTP/SQL-builder/SSR/interaction checks across 66 focused files pass,
including discussion/batch moderation, report notifications, support, profile
privacy, team governance and integrated release watches. The corrected deleted/
revoked-staff SQL mock scenarios were also rechecked separately. Web TypeScript
including generated routes, Next webpack compile-mode build, changed-file Biome
(three small pre-existing shared files lint-only) and diff checks pass. Root
TypeScript retains only the upstream delivery fixture's missing `isSigned`; Knip
retains three upstream commercial exports. Four PostgreSQL fixtures prepare
actual submission/review/resolution and batch receipts, retained 45-row tied
traversal, changed/deleted anchors, role revocation, malformed private evidence,
Unicode bounds, literal search and commercial-target exclusion. They remain
unrun without disposable PostgreSQL. Browser behavior, live query plans and full
production page generation remain outstanding. GitHub Actions are not used.


## Reviewed group resumption of release watches (2026-10-12)

The global RU/EN watch center now offers reviewed resumption of up to twenty existing,
available stopped watches. Account-wide active count is returned by an unfiltered own
subquery in the same read-only snapshot, independent of searched/filter counts. The UI
uses remaining account capacity, excludes new/unavailable references, confirms the
selection and uses the existing frozen-scope retry/abort/strict acknowledgement flow.
Private session-scoped POST /api/library/watches/resume rejects query/authority selectors,
zero/new-watch revisions, duplicate IDs, oversized bodies and unsafe mutation transport.

Collection enrollment and global resumption share one transactional enrollment engine.
Collection membership/revision checks are retained for collection callers; global commands
require a live account and every exact own existing watch. Both modes serialize account
quota, lock sorted published products/current access sources/safe builds/watch states,
then recheck finite access at database time. Only all stopped expected states can change;
all enabled exact successors confirm a retry without another audit. Mixed/stale states,
withdrawn publication, lost access, quota overflow or required audit failure abort the
whole batch. Baselines skip current committed release events; cursor/time values remain
monotonic. Saved versions, collections, entitlements, payments and existing inbox notices
are preserved. Exact state replay remains a confirmation rather than a UUID receipt.

Global resumption writes an own-user release_watches_resumed audit with only bounded
resource IDs/revisions/change count. Private history projects it as enabled batch changes,
with the same actor/target checks, malformed-evidence handling and masked current names.
Batch filtering includes stop and resume operations without admitting other actors or
system delivery logs. Migration 0073 replaces the existing partial index with the expanded
literal four-action predicate; migration 0072 remains unchanged.

Two PostgreSQL fixtures cover resumption baseline/history/no backfill/preserved pins and
one audit per operation, plus audit rollback and revoked-access rejection. They remain
unrun without a disposable PostgreSQL instance. Live migration/index plans, browser
interaction, full production generation and Node 26 validation remain open. GitHub Actions
are neither run nor inspected.

Verification: 245 focused tests across 29 files pass, including watch resumption,
existing watch/collection/history paths and the preserved community-report search/
history slice. Biome lint passes on all 21 touched TypeScript sources, and web
TypeScript passes. Root TypeScript retains only the recorded fast-check/implicit-any
and old missing isSigned delivery-fixture errors. A stale generated webpack cache
had filled the 32-GiB environment; clearing only that cache recovered 28 GiB without
changing source files. Live PostgreSQL/migration/browser checks remain unrun.

The isolated Next webpack compile-mode build exits zero with its route summary;
web TypeScript also passes after route regeneration. Full production generation
remains unverified.


## Grouped community queues and publication report batches (Agent B)

`/admin/reports/targets` now groups real community reports by exact publication or
comment target. SQL aggregates current open/review/resolved/dismissed counts with
a thirty-day default, all/7/30/90/365-day windows, literal reason/ID search and
category/target/view filters. Twenty-group keyset pages use an actor/filter-bound
database-clock cutoff, exact microseconds and immutable earliest matching report
time plus target kind/ID ordering. Counts remain current rather than representing
a stored cross-request MVCC snapshot. Anchors are resolved from scoped stored
reports and current group eligibility, never from client-supplied aggregate times.
Changed filters/audiences, future windows, deleted anchors or groups no longer in
the requested view fail with recovery links. Target metadata is fetched in at most
two bounded queries for the displayed twenty groups; the sentinel is not expanded.
Unavailable community context stays neutral and links only to an individual case.
No reporter identities, reasons/evidence arrays or staff notes enter group results.

The group queue and staff report cards link to existing comment/report moderation
and the new `/admin/community/[id]/reports` publication case screen. This screen
shows bounded current publication text, filtered twenty-report pages, retained
search/category/view filters and working preview/confirm batch controls. Its target
is resolved from an eligible publication and a current database staff role. Group
counts apply the selected event-time window; the target screens review current
related cases independently. All screens, errors, metadata, loading/empty/recovery
states and native labeled forms are localized in RU/EN and reuse existing styling.

`/api/admin/reports/targets` and `/api/admin/community/[id]/reports` provide private,
authenticated, search-limited reads. Publication `/reports/batch/preview` and
`/reports/batch` use the same validated selection and atomic write engine as
discussion batches. One-to-twenty unique pending reports are scoped to the exact
publication, reviewed with their current reasons, and frozen with a digest of the
complete publication type/title/body/precise revision plus full selected report
state. Commit rechecks current roles, target and report versions under matching
publication/actor/sorted-report locks, updates only reviewed IDs, verifies returning
identities and inserts a mandatory audit for every decision. Any stale selection,
body/revision/grant or audit failure rejects/rolls back the batch. Publication
state itself is handled by the existing moderation screen. Original discussion
request/response contracts and preview fingerprints remain compatible.

The shared client controller validates publication versus comment previews and
exact acknowledgements, coalesces rapid handlers, freezes reviewed notes/IDs and
blocks blind retries after success, conflict or uncertain mutation results. Generic
requester notices are queued after confirmed storage through the existing service;
deferred-registration/delivery failures are contained and do not erase a confirmed
decision. Notifications remain best effort. Saved decisions are visible in the
existing requester/staff history, including redacted requester receipts and staff
batch context. New responses omit reporter IDs and internal content/report digests.
Inputs reject ambiguous parameters, cross-site/non-JSON/oversized mutation bodies,
control-character searches and zero-byte notes. No schema, migration, dependency,
workflow or commercial contract changed.

Agent A optimization contract (not migrated by B):
`CREATE INDEX reports_community_target_created_id_idx ON reports(target_type,
target_id, created_at, id) WHERE target_type IN ('content','comment');`
Group readers include the same literal target predicate for prepared-plan partial
index applicability. Existing indexes remain usable; live aggregate/target query
plans and large-catalog behavior require PostgreSQL validation.

778 unit/HTTP/SQL-builder/SSR/interaction checks across 70 focused files pass. They
cover new group filters/counts/cursors/privacy, publication previews and atomic
decisions, current grants and content/report drift, confirmed client actions, safe
notification registration, plus discussion/report/support/privacy/team/release-watch
regressions. Web TypeScript including generated routes, Next webpack compile-mode
build, changed-file Biome (only the existing shared domain barrel lint-only) and
diff checks pass. Root TypeScript retains the upstream delivery fixture's missing
`isSigned`; Knip retains three upstream commercial exports. Four PostgreSQL
fixtures prepare persisted grouped counts/literal searches/noncommunity exclusion,
45 tied-group traversal and retained windows, current publication decisions and
redacted receipts, full-content/grant drift and mandatory-audit rollback. They
remain unrun without disposable PostgreSQL. Browser behavior, live query plans,
index integration and full production page generation remain outstanding. GitHub
Actions are neither run nor inspected.

After rebasing on Agent A's reviewed release-watch resume workflow, 804 checks
across 73 files pass. All 25 upstream paths, schema/migration bytes and complete
problem notes remain preserved. Group cursors now seed from the exact earliest
matching report using a bounded text MIN rather than an unbounded ID array, and
reject a changed earliest event instead of moving the boundary silently. Web
TypeScript and the integrated webpack compile-mode build pass; the build required
a retry with `NODE_OPTIONS=--max-old-space-size=4096` after the default worker heap
was exhausted. Root TypeScript still has only the known `isSigned` fixture error.
Knip retains its three upstream unused exports and additionally flags Agent A's
shared disable/resume command-schema export alias as a duplicate. That commercial
validation contract is preserved. The proposed community target index remains
unintegrated; PostgreSQL/browser/production-generation validation remains open.


## Selected reference copying between existing collections (2026-10-12)

Own collection detail/add screens now link to a dedicated RU/EN selected-copy screen.
A shared read-only repeatable-read item reader uses database snapshot time and bounded
current title projection. The copy page reads twenty source references, at most thirty
other active/writable own destinations and one bounded membership lookup (at most 600
pairs) to show genuinely missing additions against destination capacity. Archived source
collections and unavailable/deleted resource references are supported. Unavailable titles
remain masked; no build evidence, storage identifiers or download controls are returned.
Read query validation rejects unbounded pages, oversized/control-character searches and
arbitrary account/scope selectors. The private API retains session/rate/no-store/Cookie
transport, and source search/pagination remain consistent in the same database snapshot.

The new strict copy-items command includes a UUID, source ID/revision, destination revision
and canonically sorted unique IDs (one to twenty); the route fixes the destination and
session fixes the owner. All existing command actions remain valid. Apply takes the shared
owner advisory lock, locks both owned collections and exact source memberships, checks the
active destination/revisions/history quota and capacity for missing references only, then
inserts those missing entries without touching existing dates. Destination revision, an
immutable receipt and required source-provenance audit commit together. The source remains
unchanged. No products/grants/files, saved versions, watches or commercial states are changed.
Exact UUID replays return the original receipt after later source/destination changes;
reusing a request with different proof or a different destination remains a conflict.

The client reviews destination, IDs, overlap count and both revisions before submission.
It freezes the UUID/body/endpoint/acknowledgement snapshot for uncertain retries, blocks
definitive errors until reload, coalesces duplicate handlers, aborts on unmount and ignores
late responses. Receipt confirmation checks the full canonical source proof and exact
resulting destination state. Existing history renders recorded source ID/revision and
reference IDs, without looking up foreign/current source titles. Generic single-command
controls exclude the dedicated copy-items flow.

Migration 0074 replaces the receipt guard while preserving all earlier action checks and
immutability. It validates exact selected-copy shape, an own distinct source revision,
unique bounded IDs, and membership of every reference in both source and destination.
Two PostgreSQL fixtures cover orphaned-reference copying from archives, deduplication/date
preservation/concurrent replay and unchanged source/access, plus audit rollback and forged
receipt proof rejection. They remain unrun without a disposable PostgreSQL instance.
Live migration/locking/index plans, browser interaction, full production generation and
Node 26 validation remain open. GitHub Actions are neither run nor inspected.

Verification: 356 focused tests across 29 files pass, covering collection commands,
copying/retries, selected versions, release overview/preparation/watches and the preserved
community-report grouping/batch-notice slice. Biome lint passes on all 16 touched
TypeScript sources. Web TypeScript passes after regenerated routes. The isolated Next
webpack compile-mode build exits zero with its route summary. Root TypeScript retains
only the known fast-check/implicit-any and old missing isSigned delivery-fixture errors.
Live PostgreSQL fixtures/migration, browser and full production generation remain unrun.
