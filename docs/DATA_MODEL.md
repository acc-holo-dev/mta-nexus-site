# MTA NEXUS — Data Model Specification

## 1. Relational Entities (PostgreSQL 18)

| Entity | Primary Key | Description |
|---|---|---|
| `users` | `usr_...` | User accounts, credentials, profiles, global role |
| `sessions` | `ses_...` | Active web sessions, tokens, expiry |
| `organizations` | `org_...` | Development studios, server groups, companies |
| `organization_members` | `mem_...` | Team memberships, granular permissions |
| `servers` | `srv_...` | Multi Theft Auto game servers, IP/Port, player telemetry |
| `server_installations` | `ins_...` | Nexus runtime module binding instance, API key hash |
| `products` | `prd_...` | Marketplace resources (scripts, models, vehicles, UI) |
| `builds` | `bld_...` | Immutable versioned releases with SHA-256 hash |
| `assets` | `ast_...` | Physical files and archives in storage |
| `licenses` | `lic_...` | Cryptographic license keys issued to buyers |
| `entitlements` | `ent_...` | Concrete rights granted to users or servers |
| `orders` | `ord_...` | Commercial purchase records |
| `order_items` | `ite_...` | Line items within an order |
| `payments` | `pay_...` | Payment state machine transactions |
| `ledger_entries` | `ldg_...` | Double-entry append-only financial records |
| `content` | `cnt_...` | Unified articles, devlogs, announcements |
| `comments` | `cmt_...` | Product reviews and article discussions |
| `reactions` | `rec_...` | Emoji reactions to content and products |
| `follows` | `fol_...` | Social follow connections |
| `notifications` | `not_...` | User and system notifications |
| `audit_events` | `aud_...` | Security and moderation audit events |
| `reports` | `rpt_...` | Abuse, copyright, and malware reports |
| `moderation_cases` | `mod_...` | Official moderation tracking and resolutions |
