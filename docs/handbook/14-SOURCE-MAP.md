# MTA NEXUS — Source Map

> Статус: handbook v0.1, snapshot 2026-10-06.  
> Цель: объяснить, откуда восстановлена модель проекта и как разрешать расхождения.

## 1. Правило приоритета

```text
CURRENT CODE / MIGRATIONS
        ↓
CURRENT TESTS / CI
        ↓
CURRENT REPOSITORY DOCS
        ↓
OWNER DECISIONS IN THIS HANDBOOK
        ↓
RECENT PROJECT CONVERSATIONS
        ↓
LEGACY MTA-MARKET-PLATFORM
        ↓
IDEAS
```

Почему: legacy документы могут быть продуманнее и шире, но описывать продукт, от которого current NEXUS сознательно отошёл.

---

## 2. Current repository

```text
acc-holo-dev/mta-nexus-site
```

### Snapshot used

- branch: `main`;
- package version: `1.2.0-beta.3`;
- current docs/problem snapshot inspected around 2026-10-05/06.

### Current high-level README

`README.md`

Использовано для:

- current product statement;
- closed-beta boundary;
- main-only policy;
- RU/EN;
- dev startup;
- project map;
- free-resource behavior;
- release state.

### Architecture

`docs/ARCHITECTURE.md`

Использовано для:

- modular monolith;
- Next.js/PostgreSQL/Drizzle;
- resource safety invariant;
- product version consistency;
- claim semantics;
- bounded MTA directory;
- authorization/context switching;
- audit semantics;
- storage integrity;
- atomic uploads;
- cancellation;
- profile/catalog pagination;
- external URL policy;
- build review notifications;
- responsive/keyboard acceptance.

### Operations

`docs/OPERATIONS.md`

Использовано для:

- dev/Compose topology;
- ClamAV operational requirements;
- moderation queues;
- test/CI model;
- release evidence;
- Codex/AI handoff rules;
- non-negotiable constraints;
- backup/restore;
- migrations;
- production acceptance/recovery.

### Problems

`docs/PROBLEMS.md`

Использовано для current risk snapshot:

- target infrastructure acceptance;
- lint warnings;
- external MTA/preview reliability;
- download/device/load validation;
- migration inventory;
- test infrastructure;
- host engine mismatch;
- dev DB hygiene.

---

## 3. Current code/data sources

### `package.json`

Использовано для:

- version;
- Node/pnpm engines;
- test groups;
- build scripts;
- release/dev commands.

### `packages/db/src/schema.ts`

Использовано для:

- global roles;
- organization roles/permissions;
- server ownership/status/visibility;
- products/builds;
- dormant commerce tables;
- licenses/entitlements;
- content/comments/follows;
- notifications/preferences;
- reports/moderation;
- verification;
- server claim challenges.

### `packages/db/migrations/*`

Названия/смысл текущих migrations использованы как подтверждение развития:

- notification preferences/categories;
- server editorial metadata;
- review uniqueness;
- public server observations;
- server claim challenges;
- moderation indexes;
- product type invariant;
- build review notifications;
- build safety-related invariants.

### `apps/web/src/app/*` и routes

Использовано для подтверждения surfaces:

- auth;
- servers;
- market;
- products/download/reviews;
- content;
- notifications;
- organizations;
- users/developers;
- workspace;
- admin;
- reports;
- verification;
- checkout placeholder/disabled boundary.

### Tests/workflows

Использовано для понимания того, что проект считает critical acceptance:

- auth browser;
- directory browser;
- resource browser;
- scanner;
- reports;
- verification;
- moderation;
- catalog;
- resource integrity;
- production runtime;
- backup/restore/release evidence.

---

## 4. Legacy repository

```text
acc-holo-dev/mta-market-platform
```

### Что это такое

Предыдущая, более широкая итерация продукта. Она проектировала объединённую MTA ecosystem platform с сильной server/community/marketplace/trust моделью.

### Почему она полезна

В ней уже продуманы:

- business concepts;
- seller/buyer loops;
- paid commerce;
- trust;
- DRM;
- server-centric community;
- product philosophy;
- domain state machines.

### Почему ей нельзя следовать буквально

Current NEXUS:

- технически проще;
- использует другую architecture;
- closed beta free-only;
- не включает active paid commerce;
- не включает active DRM;
- intentionally avoids premature distributed infrastructure.

---

## 5. Legacy product sources

### `documents/product/PROJECT.md`

Использовано для:

- old full product definition;
- roles;
- server-centric ecosystem;
- community;
- seller flow;
- commerce flow;
- verified interactions;
- old implemented/target distinctions.

### `documents/product/VISION.md`

Использовано для durable product principles:

- community first;
- integration over duplication;
- trust by design;
- privacy by default;
- real data only;
- quality over quantity;
- visual identity matters;
- controlled UGC;
- invisible complexity;
- one ecosystem;
- future business possibilities;
- North Star thinking;
- anti-scope-creep.

### `documents/product/PRODUCT-MODEL.md`

Использовано для:

- single identity/multiple roles;
- Seller as capability;
- Purchase/Payment/License separation;
- Deal/Guarantee model;
- review eligibility concepts;
- trust/badge concepts;
- permissions thinking.

### `documents/product/PRODUCT-ARCHITECTURE.md`

Использовано как reference для domain boundaries, но не как current technical architecture.

### `documents/product/DAILY-EXPERIENCE.md`

Использовано как reference для home/dashboard/activity product thinking.

---

## 6. Legacy commerce sources

### `documents/api/COMMERCE.md`

Historical facts extracted:

- Order + OrderItem + Purchase model;
- payment-provider abstraction;
- RUB-oriented old design;
- free acquisition direct completion;
- 10% platform fee from final price;
- provider/webhook state-machine discipline;
- payment distinct from license/purchase.

### `documents/api/MARKETPLACE.md`

Использовано для historical seller/resource workflow.

### Important status

Все monetary values/provider choices/commission rates отсюда имеют статус `LEGACY`, пока владелец не подтвердит их для NEXUS.

---

## 7. Legacy trust/security sources

### `documents/ideas/TRUST.md`

Содержит future ideas:

- live demo;
- seller trust deposit;
- forensic/leak detection;
- compatibility audit;
- manager/updater.

Они сохранены как optional ideas, не commitments.

### `documents/architecture/SECURITY.md`

Useful historical security mindset, но current implementation проверяется по NEXUS code/docs/tests.

### `documents/drm/*` and `contracts/drm/*`

Historical DRM v2 concepts. Не current NEXUS runtime contract.

---

## 8. Legacy operations/development sources

`documents/development/*` и `documents/operations/*` показывают зрелый подход к:

- planning cycles;
- testing;
- production;
- backup;
- deployment;
- incident response.

Точные команды/architecture оттуда не переносились в current handbook, если не совпадают с NEXUS.

---

## 9. Conversation-derived context

Из предыдущей разработки проекта в ChatGPT учитывались устойчивые решения/направления:

- цель довести проект до релиза;
- разработка в `main`;
- желание снизить избыточность tests/CI без потери качества;
- RU/EN;
- приоритет реальной работающей системы над документационной видимостью;
- переход ответственности к AI/Codex;
- желание добавлять уникальные features, но не ценой нестабильности;
- идеи server/resource intelligence, GitHub integration, compatibility/provenance как возможные расширения.

### Caveat

Conversation intent ниже current code при прямом конфликте, если владелец не подтверждает новое решение явно.

---

## 10. Что handbook добавляет самостоятельно

Некоторые элементы — не «найденный факт», а структурирование:

- статусная модель `CURRENT / OPEN / LEGACY`;
- proposed phases roadmap;
- proposed Creator Pro / Server Pro options;
- interview structure;
- AI source-precedence rules;
- consolidated definitions of done;
- explicit business gates.

Они помечены как `OPEN`, `PROVISIONAL` или `CANDIDATE`, чтобы не выдавать synthesis за факт.

---

## 11. Главные обнаруженные расхождения

### Commerce

Legacy:

- paid marketplace;
- 10% fee;
- multiple providers;
- balance/ledger;
- payouts;
- services/disputes;
- DRM.

Current NEXUS:

- free resource acquisition;
- paid flows disabled;
- balance/payout/crypto disabled;
- DRM inactive.

### Architecture

Legacy:

- более распределённый site/module/infrastructure stack;
- отдельный native module и DRM integration.

Current NEXUS:

- intentionally modular monolith;
- one application instance target;
- PostgreSQL + private storage + ClamAV;
- no distributed complexity without measured need.

### Product emphasis

Legacy:

- SERVER как центральная сущность всей ecosystem platform.

Current statement:

- player-first platform for live server discovery, community updates and safe free-resource distribution.

### Owner decision needed

Нужно решить, является ли это окончательной сменой positioning или closed-beta упрощением перед возвратом к wider ecosystem vision.

---

## 12. Как AI должен цитировать/использовать legacy

Правильно:

> «В legacy MTA Market была модель seller application и 10% commission; для NEXUS это открытое решение.»

Неправильно:

> «MTA NEXUS берёт 10% комиссии.»

Пока Decision Register не подтверждает это.

---

## 13. Как обновлять Source Map

При значительном изменении:

- обновить snapshot date;
- добавить новый canonical doc/source;
- убрать удалённый source;
- записать новую эволюцию, если product boundary поменялся;
- не превращать Source Map в changelog каждого commit.
