# MTA NEXUS Architecture / Архитектура

This document is the durable technical source of truth for the repository.  
Этот документ — постоянный технический источник истины для репозитория.

## 1. Product boundary / Граница продукта

The closed-beta core is intentionally small:

- live public MTA server discovery;
- account and session management;
- community content, follows and notifications;
- server ownership workflows;
- free resource publishing, moderation, claiming and private binary delivery.

Paid commerce is disabled until payment, legal, refund and payout operations are designed and accepted.

## 2. Runtime shape / Runtime-архитектура

MTA NEXUS is a modular monolith:

- **Next.js 16 / React 19** in `apps/web`;
- **PostgreSQL 18 / Drizzle** in `packages/db`;
- domain types and events in `packages/domain`;
- authorization/rate limiting in `packages/security`;
- private file storage in `packages/storage`;
- shared presentation primitives in `packages/ui`;
- runtime environment validation in `packages/config`;
- request schemas in `packages/validation`.

The closed beta assumes one application instance. Do not introduce distributed infrastructure, Redis, queues, microservices or Kubernetes without a measured requirement.

## 3. Correctness invariants / Инварианты корректности

### Resource safety

A build is considered publicly downloadable only when all of these are true:

```text
status = published
scanStatus = clean
scanner is present and non-empty
scannedAt is present
```

The same predicate is shared by public build listing, latest-build resolution, moderation fallbacks, product restoration and free-resource claiming. The download route repeats the provenance check before opening storage as defense in depth.

Migration `0020_build_safety_invariants.sql` repairs legacy unsafe publication state fail-closed and adds database constraints so an unsafe build cannot remain `published`.

### Product version consistency

For every published product with a safe build:

```text
product.currentVersion =
  newest safe published build ordered by createdAt DESC, id DESC
```

Approval, rejection fallback, retirement fallback and restoration preserve this rule transactionally.

### Claims and entitlements

A free claim:

1. locks the user/product claim key inside the database transaction;
2. requires a published free product;
3. requires a safe downloadable build;
4. reuses an active entitlement on retries;
5. creates at most one active claim for the serialized path;
6. increments `salesCount` only for a newly created claim.

Expired entitlements are not accepted by authorization checks. License fallback requires an active, non-expired license.

### External MTA directory

The public MTA master list is read as a bounded stream (8 MiB maximum) and parsed with a 10,000-server limit. An oversized response is cancelled before further chunks are read. A failed refresh may serve the last successful snapshot for at most 15 minutes, marked stale. Retries are spaced by 10 seconds during an outage without extending that deadline.

Публичный список MTA читается потоком с ограничением 8 МиБ и максимумом 10 000 серверов. При ошибке обновления прежний снимок доступен не более 15 минут и помечается устаревшим.

### Authorization

Authorization is evaluated from current actor context, resource ownership and organization membership. Historical `authorId`/owner attribution is not a permanent bypass after ownership changes.

A context switch locks the user and the relevant organization/membership row, checks current access, updates `activeContextId` and records `user.context_switched` in one PostgreSQL transaction. Audit insertion failure rolls the context update back. A repeated switch to the same context creates no new audit event. Resource actions must still check their own authorization at execution time.

При смене контекста проверка доступа, запись выбранного контекста и аудит выполняются в одной транзакции. Ошибка аудита откатывает изменение; доступ к ресурсу всегда проверяется заново при самом действии.

### Audit semantics

Audit event names describe what is actually known. For binary responses, the pre-stream events are `*_download_started`; response creation is not represented as completed delivery.

## 4. RU/EN UI foundation

The global shell resolves `en` or `ru` from the `nexus_locale` cookie. The locale controls:

- document language and metadata;
- global navigation;
- footer;
- home page;
- global not-found/error messaging;
- mobile navigation;
- free-resource catalog and cards;
- workspace;
- public server directory;
- login and registration.

Remaining feature-specific copy must migrate into the same dictionary incrementally. Do not introduce a second localization mechanism.

## 5. UI architecture

Desktop uses the persistent sidebar and top navigation. Mobile uses a fixed bottom navigation so primary product areas remain reachable below the `lg` breakpoint.

UI code should use semantic design tokens from `globals.css` and shared primitives from `@nexus/ui`, not hard-coded theme colors.

## 6. Data and migrations

Schema changes require a forward migration. Migrations are append-only after they reach shared environments. A code rollback does not imply a database rollback.

Never attach an existing PostgreSQL data directory to a different PostgreSQL major version as an upgrade procedure. Use a tested dump/restore or supported `pg_upgrade` process.

## 7. Repository policy

`main` is the only maintained development line. CI, browser workflows and Dependabot target `main`. Short-lived external automation branches may exist while a tool is operating, but product development must not depend on a permanent `dev` branch.

## Resource integrity and development fixtures

`packages/domain/src/product-types.ts` owns `PRODUCT_TYPES` and `ProductType`.
Input validation, catalog filters, publishing options and database typing use
that registry. Exhaustive translation mappings cover all nine types in English
and Russian. Migration `0024_product_type_invariant` maps only the historical
`tool` alias to `plugin`, then adds a CHECK constraint; unknown values fail the
migration instead of receiving an arbitrary classification.

Development seeding separates deterministic archive preparation (`seed-archive`),
declarative records (`seed-data`) and transactional persistence (`seed-baseline`).
A transaction-scoped advisory lock serializes seed writers; existing fixture rows
are locked and checked for identity before missing IDs are inserted. Unique-key
collisions abort the transaction. Existing user edits are preserved. The explicit
repair mode changes only size/hash for matching demo builds. Audit writes belong
to the same transaction, and no-op reruns do not create audit noise. Filesystem
preparation is outside the transaction and never overwrites conflicting bytes.
A rollback can leave reusable fixture files but cannot publish partial DB rows.

Public and reviewer delivery share a metadata guard before download-started audit
writes. A known storage size/hash mismatch produces private HTTP 409 with
`BUILD_ARTIFACT_MISMATCH`, and closes the stream. Missing bytes produce 404.
Local storage obtains metadata and the stream from the same open file handle, so
pathname replacement cannot switch the streamed file after stat. Local reads
compute SHA-256 with a 64 KiB buffer before delivery and verify size/timestamps
again after hashing. Both download routes reject same-size corruption against the
recorded hash before auditing a download. This adds a full disk read before the
response, without buffering the entire archive. A privileged external writer can
still modify the same inode after verification; storage is not a tamper-proof
snapshot. Providers without metadata retain the recorded content-length fallback.

Local uploads snapshot caller-owned bytes, write a private temporary file, flush
and close it, then atomically publish it using a hard link. Existing keys always
raise a conflict, even for identical content. Concurrent writers cannot overwrite
the winner; failed writes/publications remove their temporary file. New releases
must use new keys, as `StorageService.uploadAsset` already does. This is an atomic
publication guarantee, not a cross-filesystem/database transaction or a complete
power-loss durability guarantee.

Download cancellation propagates from the HTTP request through StorageService to
local storage. Hash preparation checks the signal before opening and between
64 KiB reads, closing the descriptor on failure. A prepared stream listens for
abort and closes without emitting an unhandled error while audit is pending; its
listener is removed on stream close. Routes check cancellation before and after
audit and return private 499 `DOWNLOAD_CANCELLED` if no response has started.
An audit already written during cancellation remains a download-started event,
not evidence of completed delivery. This does not interrupt an in-flight OS read
or database operation; it stops subsequent work at the next cancellation check.

Asset keys use `assets/<validated-owner-id>/<generated-asset-id>.<extension>`.
The original filename is kept in build metadata, never in filesystem components.
This bounds key components even for long or non-ASCII names and leaves room for
atomic-upload temporary suffixes. Owner IDs are restricted to 1–128 ASCII letters,
digits, underscores or hyphens. Existing stored keys remain readable; no migration
or file rename is needed.

The resource detail download control uses a same-origin authenticated fetch so
HTTP failures stay on the product page with RU/EN messages. The client bounds
received bytes to the upload limit, checks declared length, and saves only a
complete response. It rejects HTML/JSON error pages and partial status responses.
An AbortController cancels on user request or unmount. Browser download handoff
uses a temporary object URL, revoked after handoff, replacement or unmount.
The UI reports handoff rather than claiming that the browser saved a file.
This bounded Blob approach buffers up to 64 MiB of payload, with additional
browser allocation overhead; it is not intended for unbounded large downloads.

The download client also binds abort directly to its body reader so cancellation
can release a pending read on wrapped streams. Reader cancellation is best-effort:
a stalled/rejected cleanup promise must not keep the UI busy or replace the
original HTTP failure. The reader lock and abort listener are released on exit.
Already-aborted requests do not start a fetch.

Developer profile releases use a bounded author-scoped page query (24 per page),
with a separate total under identical public/free/safe-build conditions. Stable
ordering is created_at DESC, id DESC. The repository bounds page size to 100 and
clamps requested pages to the counted final page. Counts and rows use separate
statements, so concurrent publication/moderation can change the result between
them; no snapshot-consistency guarantee is made. Other callers of the existing
full author-list method retain their current behavior.

Public user profiles also use the bounded author-resource page query. Both user
and developer profiles share parameter parsing and a server-rendered pagination
component with localized labels and a resources-section anchor. Resource totals
remain independent of page size. User-owned servers use a separate owner-scoped
active/public page query (12 per page), ordered by updated_at DESC, id DESC.
Count and page share the same visibility conditions. The `page` and `serverPage`
parameters are preserved independently by navigation, with links targeting the
corresponding section. Live-directory enrichment only runs when the selected
server page contains rows, and directory failures leave the known public servers
visible. Count and row queries do not promise snapshot consistency.

Organization resource portfolios use the same bounded free/published/safe-build
pagination implementation as author portfolios, scoped by organization ID before
counting and limiting. Pages contain 24 resources; the displayed total comes from
the matching count query. The shared profile navigation uses `page` and anchors
the resource section. Count and rows are separate queries, not a snapshot.

Organization editorial content is paged separately in batches of 12 via
`articlePage`. Organization, published status and the five editorial types
(article, news, devlog, update, announcement) are applied in SQL to both count
and rows. Ordering uses publication time (falling back to update time), then ID.
Shared navigation preserves the clamped page of the other section; empty sections
have no navigation. This removes the former first-100 in-memory article filter.
