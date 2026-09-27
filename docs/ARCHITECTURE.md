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
