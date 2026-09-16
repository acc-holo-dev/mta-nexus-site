# MTA NEXUS 1.1 — Data Model Specification

## 1. Relational Entities (PostgreSQL 18 via Drizzle ORM)

| Entity Table | Primary Key | Key Relations & Constraints |
|---|---|---|
| `users` | `usr_...` | Unique email & username, salted scrypt password hash |
| `sessions` | `ses_...` | Foreign key to `users.id` (cascade), token lookup index, expiration tracking |
| `organizations` | `org_...` | Unique slug, owner foreign key to `users.id` |
| `organization_members` | `mem_...` | Unique `(orgId, userId)`, role (owner, admin, developer, member) |
| `servers` | `srv_...` | Unique slug, foreign key to `users.id` and optional `organizations.id` |
| `server_installations` | `ins_...` | Foreign key to `servers.id`, module version, heartbeat timestamp |
| `products` | `prd_...` | Unique slug, foreign key to `users.id`, price in cents, license model |
| `builds` | `bld_...` | Foreign key to `products.id`, SHA-256 hash, unique `(productId, version)` |
| `assets` | `ast_...` | Foreign key to `users.id`, storage key, mime type, size, SHA-256 hash |
| `licenses` | `lic_...` | Unique key (`NX-TYPE-XXXX`), foreign key to `products.id`, `users.id`, `servers.id` |
| `entitlements` | `ent_...` | Polymorphic subject (`user`, `server`, `org`), permission string, resource ID |
| `orders` | `ord_...` | Unique order number, buyer foreign key to `users.id`, total amount in cents |
| `order_items` | `ite_...` | Foreign key to `orders.id` and `products.id`, unit price |
| `payments` | `pay_...` | Foreign key to `orders.id`, finite state machine (`pending` -> `completed`) |
| `ledger_entries` | `ldg_...` | Append-only double-entry financial ledger (`user:id`, `developer:id`, `platform:nexus`) |
| `content` | `cnt_...` | Unique slug, foreign key to `users.id`, view count, comment count |
| `comments` | `cmt_...` | Foreign key to `users.id`, `content.id`, or `products.id`, verified purchase flag |
| `reactions` | `rec_...` | Foreign key to `users.id`, polymorphic target |
| `follows` | `fol_...` | Foreign key to `users.id`, polymorphic target |
| `notifications` | `not_...` | Foreign key to `users.id`, unread indicator |
| `audit_events` | `aud_...` | Immutable audit log with actor ID, action, target, timestamp |
| `reports` | `rpt_...` | Reporter foreign key to `users.id`, evidence URLs, status |
| `moderation_cases` | `mod_...` | Foreign key to `reports.id`, moderator foreign key to `users.id` |
| `verification_requests` | `ver_...` | Trust layer workflow: requester, target type/id, status, reviewer, resolution notes |
| `server_heartbeats` | `ins_...` | Telemetry snapshots: installation, players, module version, recorded timestamp |
