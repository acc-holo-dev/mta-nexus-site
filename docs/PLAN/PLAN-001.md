# MTA NEXUS — MASTER IMPLEMENTATION PROMPT

## 0. РОЛЬ

Ты — senior/staff-level full-stack architect, product engineer, security engineer, database designer, DevOps engineer и UI/UX engineer одновременно.

Твоя задача — с нуля спроектировать и реализовать **MTA Nexus**, production-ready платформу для MTA:SA ecosystem.

Это не очередной MTA resource marketplace и не форум.

MTA Nexus — единая инфраструктурная платформа для:

- игроков;
- владельцев MTA:SA серверов;
- разработчиков;
- скриптеров;
- 3D artists;
- mapper'ов;
- UI/UX creators;
- студий;
- продавцов;
- покупателей;
- авторов статей;
- создателей контента;
- рекламодателей;
- поставщиков услуг.

В будущем Nexus должен также обслуживать Nexus Module — native/runtime модуль для MTA:SA.

---

# 1. КРИТИЧЕСКОЕ ПРАВИЛО

Не пытайся реализовать все известные будущие функции одновременно.

Нужен:

## Nexus 1.0

который является:

- production-ready;
- secure;
- scalable;
- compact;
- maintainable;
- modular;
- visually polished;
- extensible.

При этом архитектура обязана предусматривать future extensions:

- advanced escrow;
- freelance marketplace;
- protected assets;
- Nexus Module;
- API marketplace;
- hosting marketplace;
- studio;
- deployments;
- server automation;
- advanced analytics;
- creator marketplace;
- project marketplace.

Но если функция не относится к обязательному Nexus 1.0 scope — НЕ имитируй её.

Создавай extension points, interfaces, event contracts и schema foundations, но не создавай фальшивую функциональность.

---

# 2. ПЕРВОЕ ДЕЙСТВИЕ — RESEARCH BEFORE CODE

Перед созданием приложения:

1. Проведи актуальный web research по официальным источникам.
2. Проверь текущие stable версии всех фундаментальных зависимостей.
3. Проверь breaking changes.
4. Проверь security advisories.
5. Проверь deprecated APIs.
6. Проверь официальные integration guides для выбранных библиотек.
7. Зафиксируй результаты в `docs/STACK.md`.

Проверять нужно прежде всего:

- Next.js
- React
- TypeScript
- Node.js
- pnpm
- Tailwind CSS
- shadcn/ui
- Base UI
- Drizzle ORM
- PostgreSQL
- Zod
- Better Auth
- Vitest
- Playwright
- ESLint
- Prettier
- Docker
- relevant storage SDKs

Не доверяй случайным блогам, старым tutorial'ам, StackOverflow snippets и устаревшим AI-generated tutorials.

Для critical decisions предпочитай:

- official documentation;
- official changelog;
- official GitHub repository;
- official security advisories.

Если новая стабильная версия появляется во время разработки, оцени миграцию.

Не обновляй blindly dependency major version после начала implementation, если это может нарушить совместимость.

---

# 3. VERIFIED BASELINE AS OF SEPTEMBER 16, 2026

Используй следующие версии как исходный baseline, но перед `install` ещё раз проверь latest stable:

- Next.js 16.3
- React 19.3
- Node.js 24 LTS
- TypeScript 5.x stable
- Tailwind CSS 4.3
- shadcn/ui latest
- Base UI current stable/default path
- Drizzle ORM 1.0
- PostgreSQL 18.x stable
- Zod 4.6
- Vitest 5
- Playwright current stable
- Better Auth current stable

ВАЖНО:

Если официальный источник показывает более новую stable release на момент запуска агента — используй её вместо baseline.

Если пакет имеет beta/canary/RC и stable отсутствует — не выбирай prerelease без веской технической причины.

Никогда не используй `latest` в production dependency pinning без фиксации конкретной установленной версии в lockfile.

---

# 4. ОСНОВНАЯ АРХИТЕКТУРА

Использовать:

## Modular Monolith

Не использовать microservices architecture на старте.

НЕ создавать:

- auth-service;
- market-service;
- server-service;
- license-service;
- payment-service;
- article-service;
- notification-service;
- search-service;

как отдельные deployable applications.

Использовать одно приложение с чёткими внутренними модулями.

Пример:

```text
apps/
  web/

packages/
  ui/
  config/
  validation/
  database/
  storage/
  security/
  domain/
```

При необходимости worker может быть отдельным process, но не отдельным business service.

Архитектура должна позволять позднее вынести отдельный bounded context без переписывания всей системы.

---

# 5. ТЕХНОЛОГИЧЕСКИЙ СТЕК

## Application

Next.js + TypeScript.

Использовать современный App Router.

Использовать Server Components по умолчанию.

Client Components применять только там, где действительно нужна client-side interactivity.

Не превращать всё приложение в `"use client"`.

---

## Runtime

Node.js 24 LTS.

Не использовать experimental runtime без необходимости.

---

## Package manager

pnpm.

Использовать один lockfile.

Не смешивать npm/yarn/pnpm.

---

## Database

PostgreSQL 18 stable.

Database-first relational design.

Использовать:

- foreign keys;
- unique constraints;
- check constraints;
- indexes;
- partial indexes;
- composite indexes;
- transactions;
- proper isolation where required;
- database-level integrity.

Не полагаться только на application validation.

---

## ORM

Drizzle ORM 1.x current stable.

Обязательно ознакомиться с current Drizzle v1 relations API.

Не использовать устаревшую v0 relational query architecture.

Использовать:

- strongly typed schema;
- migrations;
- explicit indexes;
- SQL where useful;
- transactions;
- database constraints.

Не скрывать важную бизнес-логику внутри магических ORM abstractions.

---

## Validation

Zod 4.x current stable.

Использовать одну систему schemas для:

- forms;
- API inputs;
- API outputs;
- environment config;
- webhooks;
- uploads metadata;
- settings;
- permissions payloads.

Не дублировать типы вручную там, где schema может быть source of truth.

---

## Auth

Для нового проекта сначала evaluate Better Auth current stable.

Не автоматически использовать старые Auth.js tutorials.

Authentication architecture должна поддерживать:

- email/password;
- email verification;
- password reset;
- Discord OAuth;
- session management;
- 2FA;
- organization/team membership;
- roles;
- permissions;
- trusted sessions/devices;
- account security.

Никогда:

- не хранить plaintext passwords;
- не помещать secrets в client bundle;
- не доверять client role flags;
- не использовать user-submitted role IDs без server authorization.

---

## UI

Tailwind CSS 4.x current stable.

shadcn/ui current stable.

For new shadcn projects use the current Base UI path unless official docs show a better current recommendation.

Не копировать устаревшие shadcn examples blindly.

Все UI primitives должны находиться внутри проекта и быть контролируемыми командой.

Использовать единую Nexus design system.

---

## Icons

Использовать одну icon system.

Не смешивать множество icon libraries.

---

## Forms

Использовать schema-driven forms.

Client validation + server validation.

Никогда не полагаться только на browser validation.

---

## Testing

Vitest 5 current stable для unit/integration-level tests.

Playwright current stable для browser E2E.

Использовать Playwright test agents/features, если они действительно помогают агенту при exploratory testing, но тестовая архитектура должна оставаться обычной, читаемой и контролируемой.

---

# 6. ПОЧЕМУ НУЖЕН NEXT.JS FULL-STACK

НЕ создавать отдельный Express/Nest backend на Nexus 1.0.

Использовать Next.js как application layer:

```text
Browser
    ↓
Next.js
    ↓
Domain services
    ↓
Drizzle
    ↓
PostgreSQL
```

Для внутренних API:

- Route Handlers;
- Server Actions where appropriate;
- domain services;
- background workers.

Не помещать бизнес-логику непосредственно в React components.

---

# 7. REPOSITORY STRUCTURE

Создай компактный, но профессиональный monorepo.

Рекомендуемая структура:

```text
mta-nexus-site/
│
├── apps/
│   └── web/
│
├── packages/
│   ├── ui/
│   ├── db/
│   ├── domain/
│   ├── validation/
│   ├── security/
│   ├── storage/
│   ├── config/
│   └── tooling/
│
├── docs/
│   ├── STACK.md
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DATA_MODEL.md
│   ├── API.md
│   ├── STORAGE.md
│   ├── AUTH.md
│   ├── DEPLOYMENT.md
│   └── DEVELOPMENT.md
│
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── fixtures/
│
├── scripts/
│
├── infra/
│   └── docker/
│
├── .env.example
├── compose.yaml
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── README.md
└── ...
```

Не плодить сотни файлов без необходимости.

---

# 8. DOMAIN MODULES

Основные bounded contexts:

```text
identity
organizations
servers
developers
catalog
products
assets
builds
licensing
commerce
content
discovery
notifications
moderation
advertising
support
system
```

Некоторые будущие домены могут пока существовать только как schema foundations/interfaces:

```text
deals
escrow
projects
automation
deployments
api-platform
```

---

# 9. CORE ENTITIES

Основная модель данных:

```text
User
Organization
OrganizationMember
Role
Permission

Server
ServerInstallation

DeveloperProfile

Product
ProductVersion / Build
Asset
AssetVariant

License
Entitlement

Order
OrderItem
Payment
LedgerEntry
Subscription

Content
Comment
Reaction
Follow

Notification
AuditEvent

AdCampaign
AdPlacement

Report
ModerationCase

SupportTicket
SupportMessage
```

---

# 10. IMPORTANT ENTITY RULES

## User

User — identity, а не developer/server owner.

Один user может одновременно:

- покупать;
- продавать;
- разрабатывать;
- владеть сервером;
- состоять в студии;
- создавать контент.

Не создавать отдельные account systems.

---

# 11. ORGANIZATION

Organization используется для:

- Studio;
- server team;
- company;
- development team.

Продукты не должны обязательно принадлежать физическому User.

Они могут принадлежать Organization.

Это позволит человеку покинуть команду без потери ownership.

---

# 12. SERVER

Server — самостоятельная сущность.

Хранить:

- identity;
- name;
- slug;
- description;
- visibility;
- status;
- owner;
- organization;
- public profile;
- settings;
- statistics references.

Не позволять серверу публиковать внутреннюю информацию без явной настройки владельца.

---

# 13. SERVER INSTALLATION

Нexus Module installation должна быть отдельной сущностью.

Например:

```text
Server
  ↓
Installation
  ↓
Module instance
```

Поддерживать:

- installation identity;
- activation;
- revoked state;
- created at;
- last seen;
- version;
- capabilities;
- environment;
- audit information.

---

# 14. PRODUCT

Product — универсальная бизнес-сущность.

Тип:

```text
script
model
vehicle
map
ui
plugin
api
service
bundle
package
```

Не создавать отдельную marketplace architecture под каждый тип.

---

# 15. PRODUCT ≠ ASSET

Product:

> Vehicle Pack Pro

Assets:

```text
dff
txd
col
images
documentation
build archive
screenshots
```

---

# 16. PRODUCT ≠ BUILD

Product:

```text
Vehicle Pack Pro
```

Build:

```text
4.2.1
```

Build должен иметь:

- version;
- immutable identity;
- hash;
- status;
- release notes;
- compatibility metadata;
- assets;
- created_at;
- signed/verified state.

После публикации build не изменять.

При исправлении создавать новый build.

---

# 17. LICENSE

License связывает:

```text
buyer
product
server / installation
```

Может иметь:

```text
active
expired
revoked
suspended
```

Но license не должна сама содержать все permissions.

Для permissions использовать `Entitlement`.

---

# 18. ENTITLEMENT

Entitlement означает:

> субъект имеет право X на объект Y.

Примеры:

```text
server A
→ run
→ product X
```

```text
developer A
→ advanced-protection
→ expires 2027-01-01
```

```text
studio A
→ premium-analytics
```

Это центральный access-control primitive Nexus.

---

# 19. ORDER

Order — коммерческая операция.

Типы:

```text
product
service
subscription
advertisement
api
bundle
```

Не создавать отдельный payment system на каждый вид покупки.

---

# 20. PAYMENT

Payment должен иметь state machine.

Минимум:

```text
pending
authorized
completed
failed
refunded
partially_refunded
disputed
cancelled
```

Никаких boolean:

```text
isPaid
```

как единственного источника истины.

---

# 21. LEDGER

Для денег использовать immutable ledger entries.

Пример:

```text
Buyer         -50000
Escrow        +50000
```

после завершения:

```text
Escrow        -50000
Developer     +46500
Nexus          +3500
```

Не пересчитывать историческую финансовую информацию только из mutable records.

Ledger append-only.

---

# 22. CONTENT ENGINE

Одна универсальная Content model.

Типы:

```text
article
post
news
devlog
update
announcement
question
review
```

Не создавать отдельную CMS:

- для статей;
- для news;
- для devlog;
- для updates.

Использовать общий content engine.

---

# 23. CONTENT LINKS

Content может быть связан с:

```text
Server
Developer
Organization
Product
Project
Deal
```

Пример:

```text
Article
  ↓
Server X
  ↓
Product Y
  ↓
Developer Z
```

---

# 24. FEED

Feed не является отдельной CMS.

Feed строится из Events.

Пример:

```text
product.updated
server.updated
article.published
developer.released_build
server.event_created
```

Event может питать:

- feed;
- notification;
- analytics;
- audit;
- automation;
- webhook.

Это одно из основных архитектурных правил Nexus.

---

# 25. EVENT SYSTEM

Создать внутренний typed domain event system.

Примеры:

```text
product.created
product.published
product.updated

build.created
build.published

license.created
license.expired
license.revoked

server.created
server.updated

article.published

order.created
payment.completed

notification.created
```

Каждое событие должно иметь:

- event id;
- event type;
- version;
- timestamp;
- actor;
- aggregate/entity;
- payload;
- correlation id;
- causation id when applicable.

---

# 26. EVENT RULES

Events должны быть:

- typed;
- versioned;
- idempotency-aware;
- auditable.

Не строить ненадёжные цепочки из direct function calls между десятками модулей.

---

# 27. DISCOVERY ENGINE

Один engine для:

- Home;
- Explore;
- Search;
- trending;
- recommendations;
- related products;
- related developers;
- related servers.

Не создавать разные recommendation algorithms под каждую страницу.

Первый этап:

```text
relevance
freshness
activity
popularity
growth
follow relationship
```

Не создавать machine learning infrastructure без реальной необходимости.

---

# 28. SEARCH

На Nexus 1.0:

PostgreSQL search / full-text search.

Поддерживать:

- Products;
- Servers;
- Developers;
- Organizations;
- Articles;
- Services;
- Jobs when introduced.

Не добавлять Elasticsearch/OpenSearch, пока реальные данные не покажут необходимость.

Search abstraction сделать так, чтобы отдельный search engine можно было добавить позже.

---

# 29. STORAGE ABSTRACTION

Разработчик:

```text
Upload
```

НЕ должен знать:

- где хранится файл;
- какой provider;
- какой bucket;
- какой storage node.

Nexus сам решает.

Использовать abstraction:

```text
StorageProvider
```

Поддерживать архитектурно:

```text
local
s3
yandex
other object storage
```

Storage routing должна быть server-side.

---

# 30. STORAGE POOL

Администратор сможет иметь:

```text
Storage #1
Storage #2
Backup #1
Archive #1
```

И политики:

```text
asset size
asset type
importance
region
replication
```

Nexus выбирает provider автоматически.

---

# 31. REPLICATION

Поддерживать в model:

```text
primary
replica
archive
```

Структура должна позволять хранить несколько locations для одного logical asset.

---

# 32. STORAGE INTEGRITY

Каждый asset:

```text
sha256
size
mime
storage key
created_at
```

Хэш является частью integrity model.

---

# 33. PRIVATE ASSETS

Не отдавать raw storage URLs без необходимости.

Использовать:

- authorization;
- short-lived signed access;
- proxy delivery;
- internal resolver;
- access policies.

Не хранить provider secrets в database plaintext.

---

# 34. UPLOAD PIPELINE

Upload должен иметь state machine:

```text
initiated
uploading
uploaded
validating
processing
ready
quarantined
failed
deleted
```

Не делать:

```text
upload = true
```

---

# 35. LARGE FILE HANDLING

Предусмотреть:

- multipart uploads;
- resumable uploads where provider supports it;
- streaming;
- size limits;
- MIME validation;
- extension validation;
- checksum;
- timeout;
- retry;
- orphan cleanup.

Никогда не загружать гигабайтный файл целиком в Node memory.

---

# 36. SECURITY — GLOBAL RULES

Обязательно:

- secure cookies;
- HttpOnly;
- SameSite;
- CSRF protection where applicable;
- origin validation;
- rate limiting;
- brute-force mitigation;
- input validation;
- output encoding;
- XSS protection;
- SSRF protection;
- SQL injection protection;
- path traversal protection;
- upload abuse protection;
- webhook signature validation;
- authorization on server;
- privilege escalation prevention.

---

# 37. AUTHORIZATION

Никогда не делать:

```text
if (session.user.role === "admin")
```

единственным authorization mechanism.

Использовать server-side policy functions:

```text
can(user, action, resource)
```

Например:

```text
can(user, "product.update", product)
can(user, "server.manage", server)
can(user, "license.revoke", license)
```

---

# 38. ID SYSTEM

Не использовать sequential integer IDs публично для всех entities.

Использовать безопасные opaque IDs.

Slug использовать отдельно:

```text
id
slug
```

Не считать slug security boundary.

---

# 39. PUBLIC VS INTERNAL DATA

Каждая entity должна иметь public DTO и internal model.

Никогда не сериализовать database row напрямую в client.

Это защищает:

- internal ids;
- audit metadata;
- security flags;
- storage keys;
- provider data;
- financial internals.

---

# 40. RATE LIMITING

Централизованный abstraction:

```text
rateLimit("auth.login", key)
rateLimit("upload.create", userId)
rateLimit("search", ip/user)
rateLimit("api", apiKey)
```

На MVP можно использовать database-backed strategy там, где это достаточно.

Redis не добавлять только ради моды.

---

# 41. EMAIL

Сделать provider abstraction.

Шаблоны:

```text
welcome
verify-email
password-reset
security-alert
purchase
license
product-update
server-alert
deal
```

Не привязывать domain code к конкретному email provider.

---

# 42. NOTIFICATIONS

Unified notification model.

Типы:

```text
in_app
email
webhook
discord
telegram
```

Пользователь сам выбирает настройки.

---

# 43. ADMINISTRATION

Admin workspace:

```text
Overview
Users
Organizations
Servers
Products
Builds
Licenses
Orders
Payments
Content
Reports
Advertisements
Storage
Module installations
System health
Audit
```

---

# 44. MODERATION

States:

```text
draft
pending_review
approved
rejected
changes_requested
suspended
archived
```

Для moderation case:

```text
target
reporter
reason
evidence
moderator
status
resolution
audit trail
```

---

# 45. REPORTS

Report types:

```text
scam
copyright
malware
abuse
fake_product
fake_server
spam
other
```

Все reports должны иметь immutable history.

---

# 46. COPYRIGHT / AUTHOR CLAIMS

Создать foundation для author claims.

Claim должен позволять связать:

```text
claimant
target product
evidence
publication history
build history
license history
```

Не обещать юридический verdict.

Платформа фиксирует evidence и применяет свои platform policies.

---

# 47. TRUST SYSTEM

Не использовать одно магическое число:

```text
Trust = 89
```

Для Nexus 1.0 лучше:

```text
identity verified
developer verified
server verified
verified purchase
completed transactions
completed contracts
active since
```

Фактические показатели должны быть прозрачными.

---

# 48. DEVELOPER PROFILE

Публичный профиль:

```text
Profile
Products
Articles
Portfolio
Services
Servers
Reviews
```

Данные должны собираться из реальных Nexus entities.

---

# 49. SERVER PROFILE

Страница:

```text
Overview
Updates
Articles
Events
Reviews
Statistics
Team
Jobs
```

Владелец сервера сам выбирает публичность внутренних данных.

Не раскрывать автоматически список используемых ресурсов.

---

# 50. MARKET

Market categories:

```text
Scripts
Models
Vehicles
Maps
UI
Plugins
APIs
Services
Bundles
```

Это один catalog.

---

# 51. PRODUCT PAGE

Product page должна включать:

```text
title
author
verification
protection status
current version
price
license model
compatibility
screenshots
features
changelog
documentation
reviews
questions
support
```

---

# 52. PRODUCT REVIEWS

Review должна поддерживать:

```text
verified purchase
verified server
installation
documentation
performance
support
comments
```

Не позволять произвольную review inflation.

---

# 53. PRODUCT QUESTIONS

Questions attached to product.

Ответ автора может сохраняться как FAQ knowledge.

Не создавать отдельный forum engine для Products.

---

# 54. PRODUCT COMPATIBILITY

Metadata:

```text
MTA version
Nexus Module version
required dependencies
supported server environment
```

Поддерживать compatibility matrix архитектурно.

---

# 55. PRODUCT BUNDLES

Bundle состоит из Products.

Не копировать product data.

Bundle references existing products.

---

# 56. PRODUCT RELEASES

Build release:

```text
draft
testing
published
deprecated
retired
```

Published build immutable.

---

# 57. LICENSE MODELS

Архитектурно предусмотреть:

```text
single_server
multiple_servers
per_installation
organization
subscription
seat
quota
exclusive
```

Не все модели обязаны быть UI в 1.0.

---

# 58. CHECKOUT

Один checkout engine.

Use cases:

```text
product
bundle
service
subscription
advertising
```

Не пять разных checkout pages с разной логикой.

---

# 59. FUTURE ESCROW FOUNDATIONS

Даже если advanced escrow не входит полностью в 1.0, подготовить:

```text Deal
Milestone
PaymentHold
Dispute
Evidence
Delivery
```

Но не включать неподдерживаемую production escrow behavior без реальной payment architecture.

---

# 60. FUTURE SERVICES / FREELANCE

Architecture должна позволять:

```text
Service Product
Request
Proposal
Deal
Milestone
Review
Payment
```

Service — это Product subtype, а не совершенно отдельный commerce engine.

---

# 61. FUTURE API MARKETPLACE

Architecture должна предусматривать:

```text API Product
API Key
Entitlement
Subscription
Usage
Rate Limit
Billing
```

Но не реализовывать полноценный public API marketplace в Nexus 1.0.

---

# 62. FUTURE HOSTING MARKETPLACE

Предусмотреть generic vendor/product architecture.

Не привязывать core architecture к одному hosting provider.

---

# 63. FUTURE CREATOR MARKETPLACE

Architecture должна позволять:

```text Campaign
Creator
Deliverable
Attribution
Analytics
Payment
```

Не реализовывать полный creator network в 1.0.

---

# 64. ARTICLES

Articles входят в Nexus 1.0.

Обязательно:

- rich editor;
- drafts;
- publish;
- cover;
- tags;
- categories;
- author;
- related server/product/developer;
- SEO metadata;
- slug;
- views;
- reactions;
- comments;
- revisions.

---

# 65. SEO

Каждая публичная entity должна иметь:

```text
title
description
canonical
OpenGraph
Twitter/X card where useful
sitemap entry
robots rules
structured data where appropriate
```

URL examples:

```text
/servers/project-x
/developers/horizon
/products/vehicle-pack
/articles/how-to-optimize-mta
```

---

# 66. FEED

Home is personalized feed.

Feed sources:

```text followed developers
followed servers
followed products
topics
new releases
articles
server updates
community posts
```

Sponsored content must remain visibly separated from organic content.

---

# 67. DISCOVERY

Pages:

```text
/explore
```

Filters:

```text
type
category
language
price
updated
popular
new
verified
```

Sorting must be deterministic and testable.

---

# 68. PLAYER EXPERIENCE

For ordinary player:

```text
Home
Explore
Servers
Developers
Market
Articles
```

No overwhelming admin-style UI.

---

# 69. WORKSPACE

Workspace is contextual.

Personal:

```text
Purchases
Licenses
Orders
Saved
Notifications
```

Server owner:

```text
Servers
Products
Licenses
Analytics
Updates
Team
Advertising
```

Developer:

```text
Products
Builds
Licenses
Sales
Services
Articles
Support
Analytics
```

Studio:

```text
Team
Projects
Products
Servers
Deals
Revenue
Storage
```

---

# 70. CONTEXT SWITCHER

One account can switch between:

```text
Personal
Server X
Studio Y
```

Do not create separate applications.

---

# 71. SIDEBAR

Desktop-first.

Compact.

Collapsible.

No duplicate navigation.

No duplicate profile in sidebar + top bar.

No empty top bar.

Search must be prominent.

Theme toggle should be a single consistent control.

---

# 72. RESPONSIVE DESIGN

Desktop-first because Nexus is expected to be heavily desktop-oriented.

But must remain usable on:

- tablet;
- mobile.

Mobile should simplify, not mirror desktop literally.

---

# 73. DESIGN SYSTEM

Create Nexus design system:

```text
Button
Input
Textarea
Select
Dialog
Drawer
Tooltip
Popover
Dropdown
Tabs
Badge
Avatar
Card
Table
DataTable
Pagination
EmptyState
ErrorState
Skeleton
CommandPalette
Toast
Breadcrumb
Sheet
```

Components should be reusable.

Do not create dozens of one-off components.

---

# 74. VISUAL DIRECTION

Design target:

- mature;
- professional;
- modern;
- compact;
- premium;
- technical;
- MTA-centric without looking like an old game forum.

Avoid:

- excessive gradients;
- oversized cards;
- huge whitespace;
- childish gaming aesthetic;
- emoji-driven UI;
- redundant borders;
- unnecessary glassmorphism everywhere.

---

# 75. THEMES

Support:

```text
light
dark
system
```

But default design iteration should prioritize light theme first.

Use CSS variables/design tokens.

Do not hardcode colors in hundreds of components.

---

# 76. TYPOGRAPHY

Choose one modern variable font or small font stack.

Do not ship huge font libraries without reason.

Typography must remain compact and readable.

---

# 77. ANIMATION

Use subtle motion only.

Do not animate entire layouts unnecessarily.

Respect:

```text prefers-reduced-motion
```

---

# 78. ACCESSIBILITY

Target good WCAG practices:

- keyboard navigation;
- visible focus;
- semantic HTML;
- correct labels;
- accessible dialogs;
- screen reader names;
- sufficient contrast;
- reduced motion.

---

# 79. COMMAND PALETTE

Implement:

```text
Ctrl/Cmd + K
```

Actions such as:

```text
Search product
Open server
Create product
Create article
Open license
Upload build
Open order
Open settings
```

Command palette should use the same server-side permission rules.

---

# 80. GLOBAL SEARCH

Search can return grouped results:

```text
Products
Servers
Developers
Articles
Services
```

Search suggestions should appear while typing.

---

# 81. PROFILE SYSTEM

Public profile and private account settings must be separate.

Public:

```text
avatar
name
bio
roles
products
articles
portfolio
servers
```

Private:

```text
email
security
sessions
billing
API keys
preferences
```

---

# 82. FOLLOW SYSTEM

Can follow:

```text
developer
organization
server
product
topic
```

Do not follow raw database IDs directly from client.

---

# 83. SAVED / COLLECTIONS

Users can save:

```text
products
articles
servers
developers
jobs
services
```

Architecture should support future collections.

---

# 84. NOTIFICATION SYSTEM

Notification center:

```text
All
Unread
Commerce
Security
Servers
Products
System
Mentions
```

---

# 85. SECURITY CENTER

User must see:

```text
Active sessions
Trusted devices
2FA
Password status
OAuth accounts
API keys
Login history
```

---

# 86. 2FA

At minimum architecture must support TOTP.

For critical actions optionally require recent authentication:

```text
payout
ownership transfer
license revoke
API key create
admin action
```

---

# 87. ORGANIZATION ROLES

Use permission-based model.

Possible defaults:

```text
owner
admin
manager
developer
designer
support
viewer
```

These are presets, not the security primitive.

---

# 88. CUSTOM PERMISSIONS

Support:

```text
product.read
product.write
product.publish
product.license.manage
server.read
server.manage
analytics.read
billing.read
billing.manage
team.manage
content.publish
```

Not every permission needs a UI in 1.0.

---

# 89. AUDIT LOG

Audit immutable-ish append-only records for critical operations.

Record:

```text
actor
action
target
timestamp
IP where appropriate
request/correlation id
result
metadata
```

Do not log secrets.

---

# 90. OBSERVABILITY

Need:

```text
request metrics
error rate
latency
database health
storage health
job health
auth failures
```

Use OpenTelemetry-compatible abstractions if practical.

Do not create giant observability stack if simple logging/metrics are sufficient initially.

---

# 91. LOGGING

Structured logs.

Example:

```json
{
  "level": "info",
  "event": "license.created",
  "actorId": "...",
  "entityId": "...",
  "requestId": "...",
  "timestamp": "..."
}
```

Never log:

- passwords;
- session tokens;
- raw API secrets;
- payment credentials.

---

# 92. ERROR HANDLING

Every user-facing error must be:

```text
human readable
stable error code
safe message
```

Internal diagnostics stay server-side.

Example:

```text
UPLOAD_FILE_TOO_LARGE
```

rather than exposing stack traces.

---

# 93. ERROR BOUNDARIES

Implement:

- route-level error handling;
- application-level fallback;
- loading states;
- not-found states;
- permission-denied states;
- offline-ish degradation where useful.

---

# 94. DATABASE ERROR POLICY

Do not return raw Postgres errors to browser.

Map database exceptions to application errors.

Handle:

- unique violations;
- foreign key violation;
- serialization failure;
- timeout;
- connection loss.

Retry only safe/idempotent operations.

---

# 95. CONCURRENCY

Be very careful with:

- license creation;
- order completion;
- ledger writes;
- inventory-like limits;
- subscription state;
- entitlement changes.

Use transactions and constraints.

Do not rely on:

```text SELECT → IF → INSERT
```

without atomicity.

---

# 96. IDEMPOTENCY

Critical operations should support idempotency:

```text
payment webhook
license issuance
build publication
storage processing
notifications
```

Use idempotency keys.

---

# 97. WEBHOOKS

Future-ready architecture:

```text event
→ webhook
→ signature
→ retry
→ delivery log
```

Webhook delivery should support:

```text pending
delivered
failed
retrying
disabled
```

Do not lose events silently.

---

# 98. BACKGROUND JOBS

Tasks such as:

- email;
- indexing;
- image processing;
- file processing;
- cleanup;
- notifications

should not block normal HTTP request.

Initial implementation may use PostgreSQL-backed jobs if sufficient.

Do not introduce Redis unless needed.

---

# 99. JOB DESIGN

Jobs need:

```text job id
type
payload
attempt
status
scheduledAt
startedAt
finishedAt
error
```

State:

```text queued
running
completed
failed
retrying
dead
```

---

# 100. RETRIES

Retry only transient failures.

Use backoff.

Don't retry permanent validation failures forever.

---

# 101. CRON

Use scheduled jobs for:

```text expired licenses
notifications digest
cleanup
storage orphan detection
analytics rollups
```

Do not duplicate scheduler logic in multiple modules.

---

# 102. STORAGE CLEANUP

Need orphan cleanup.

Example:

```text uploaded
processing failed
asset abandoned
```

Should not permanently consume storage.

---

# 103. DATA RETENTION

Document retention rules.

Do not delete audit/financial records accidentally through generic cascade delete.

Use explicit archival strategy where appropriate.

---

# 104. SOFT DELETE

Do NOT blindly soft-delete every table.

Use soft deletion where business recovery matters.

Use permanent deletion where privacy requirements demand it and where legally/operationally appropriate.

---

# 105. PRIVACY

Provide:

```text profile visibility
activity visibility
server visibility
email visibility
```

Never expose private email addresses by default.

---

# 106. LEGAL FOUNDATION

Create:

```text Terms
Privacy
Seller Rules
Buyer Rules
License Rules
Refund Policy
Copyright Policy
Advertising Policy
Community Rules
```

Version them.

Store acceptance metadata.

---

# 107. ADMIN SYSTEM

Admin pages need:

- search;
- filters;
- pagination;
- bulk actions only where safe;
- audit;
- confirmation for destructive actions.

No destructive action without confirmation.

---

# 108. DANGEROUS ACTION PROTECTION

For:

- revoke license;
- delete product;
- delete organization;
- refund;
- ownership transfer;
- payout;
- admin privileges;

require appropriate authorization and possibly recent authentication.

---

# 109. PAYMENTS

Payment provider must be abstracted.

Core domain must NOT depend directly on one provider.

Interface:

```text
PaymentProvider
```

Possible future providers:

```text
Provider A
Provider B
Provider C
```

When selecting actual provider for production, research:

- country availability;
- legal compatibility;
- marketplace payouts;
- split payments;
- subscriptions;
- disputes;
- refunds;
- webhooks;
- KYC/KYB.

Do not invent unsupported payment capabilities.

---

# 110. FILE SECURITY

For uploaded:

```text zip
rar
7z
js
lua
dll
exe
dff
txd
col
png
jpg
```

perform strict validation.

Never trust extension.

MIME/type inspect.

Protect against:

- zip bombs;
- decompression bombs;
- path traversal;
- nested archive abuse;
- executable payload abuse;
- malicious polyglots.

---

# 111. MALWARE SCANNING

Architecture should support scanner adapter:

```text MalwareScanner
```

But do not pretend a scanner exists if it is not configured.

If scanner unavailable:

```text status = scan_unavailable
```

rather than fake “safe”.

---

# 112. PRODUCT VERIFICATION

Verification pipeline can inspect:

- metadata;
- manifest;
- file structure;
- dependencies;
- integrity;
- scanner status.

Do not certify “safe” merely because upload succeeded.

---

# 113. SEO CONTENT STRATEGY

Articles should support:

- slug;
- canonical URL;
- search indexing;
- internal links;
- related products;
- related servers;
- related developers.

Content should help bring organic traffic into Nexus.

---

# 114. DISCOVERY LOOP

Architecture should enable:

```text
Article
↓
Developer
↓
Product
↓
Server
↓
Update
↓
Feed
↓
New visitor
```

Do not require manual duplication of content.

---

# 115. ADS

Nexus 1.0 should establish basic advertising infrastructure.

Model:

```text Campaign
Placement
Creative
Budget
Schedule
Targeting
Status
Metrics
```

Possible objects:

```text server
product
developer
article
service
job
```

Sponsored content must be labeled.

---

# 116. AD PLACEMENTS

Support architecture for:

```text
homepage
explore
market
server discovery
article
sidebar
featured
```

Do not overload pages with ads.

---

# 117. SERVER DASHBOARD

Server workspace:

```text
Overview
Players
Statistics
Updates
Products
Licenses
Team
Advertising
Articles
Events
```

---

# 118. SERVER METRICS

1.0 basic:

```text
online
peak
status
uptime
last seen
```

Future:

```text
retention
average session
growth
player history
```

---

# 119. PUBLIC SERVER DATA

Important:

Server owners explicitly decide what is public.

No automatic exposure of:

- used resources;
- internal IPs;
- private team;
- private products;
- internal performance data.

---

# 120. NEXUS MODULE FOUNDATION

Nexus Site must have a clean conceptual contract with future Nexus Module.

The site is:

```text
control plane
```

Module is:

```text
runtime enforcement / execution plane
```

Site:

```text identities
licenses
entitlements
builds
policies
```

Module:

```text enforce
load
validate
report
```

Do not put Module runtime logic into web application.

---

# 121. MODULE INSTALLATION MODEL

Create:

```text ServerInstallation
```

and future capabilities:

```text core
licensing
secure
updates
diagnostics
backup
```

Use capability model.

---

# 122. MODULE PROTOCOL FOUNDATION

Future API must support:

```text authenticate installation
get capabilities
get entitlements
fetch authorized build
send heartbeat
send status
send audit event
```

But do not implement dangerous remote execution.

---

# 123. OFFLINE POLICY

Important:

Temporary Nexus outage must not automatically destroy production server operation.

Design for:

```text cached entitlement
expiration/grace
local verification
revocation strategy
```

Future secure module architecture should be tolerant of network interruptions.

---

# 124. MODULE SECURITY

Module secrets must never be represented as normal user-editable Lua configuration.

The web application should not assume that client-side secrets are secret.

---

# 125. FRONTEND DATA FETCHING

Use the simplest appropriate mechanism.

Prefer:

- Server Components;
- server-side queries;
- server actions;
- route handlers.

Use client fetching only when needed for interactivity/realtime.

Do not create a giant React query cache for every page by default.

If client query library is introduced, justify it.

---

# 126. CACHING

Use caching deliberately.

Distinguish:

```text public cache
private user data
stale-while-revalidate
uncached critical data
```

Never cache sensitive user-specific response under shared public cache.

---

# 127. REALTIME

Do NOT introduce WebSocket infrastructure just because it is modern.

For 1.0:

- polling where sufficient;
- SSE where useful;
- realtime only where actual UX requires it.

Possible future realtime:

```text notifications
server status
messages
deal status
```

---

# 128. API DESIGN

Even though app is a modular monolith, APIs should be clean.

Use:

```text /api/...
```

with predictable versioning strategy.

Do not invent GraphQL merely because Nexus is large.

REST/typed route handlers are sufficient for 1.0.

---

# 129. API RESPONSES

Use stable envelope where it improves consistency.

For errors:

```json
{
  "error": {
    "code": "LICENSE_NOT_FOUND",
    "message": "License was not found."
  }
}
```

No stack traces.

---

# 130. API AUTH

Every private API route must perform:

1. authentication;
2. authorization;
3. validation.

Never only one of these.

---

# 131. CSRF

Apply current Next.js/auth stack security guidance.

Do not blindly add obsolete middleware patterns.

Remember Next.js 16 current terminology/API changes.

---

# 132. ROUTING

Use Next.js App Router.

Public:

```text
/
 /explore
 /servers
 /servers/[slug]
 /developers
 /developers/[slug]
 /products
 /products/[slug]
 /articles
 /articles/[slug]
 /deals
```

Authenticated:

```text
/dashboard
/workspace
/licenses
/orders
/settings
```

Contextual:

```text
/workspace/servers/[id]
/workspace/products/[id]
/workspace/studio/[id]
```

Admin:

```text
/admin
```

---

# 133. EMPTY STATES

Every major list needs useful empty state.

Example:

```text
No products yet.

Create your first product →
```

Not blank whitespace.

---

# 134. LOADING STATES

Use meaningful skeletons.

Do not create layout jumps.

---

# 135. ERROR STATES

Provide retry where safe.

Example:

```text
Couldn't load server statistics.
Try again.
```

---

# 136. PAGINATION

Use cursor pagination for feeds/large changing lists where appropriate.

Use simple page pagination where stable and useful.

Do not use offset pagination for every large dataset automatically.

---

# 137. DATABASE INDEXING

Design indexes from query patterns.

At minimum evaluate:

```text user email unique
slug unique where applicable
product status + created_at
server status + updated_at
content published_at
license server_id + status
orders buyer_id + created_at
notifications user_id + created_at
audit target + created_at
```

Do not create random indexes everywhere.

---

# 138. DATABASE MIGRATIONS

Migration policy:

- forward migration;
- deterministic;
- reviewed;
- reversible where practical;
- no destructive mutation without explicit plan.

Never alter production DB manually without migration representation.

---

# 139. SEED DATA

Create realistic development seed:

```text admin
developer
studio
server
products
articles
orders
licenses
reviews
notifications
```

Use obviously fake development data.

---

# 140. ENVIRONMENT CONFIG

Use validated env schema.

Required groups:

```text APP
DATABASE
AUTH
STORAGE
EMAIL
PAYMENT
SECURITY
OBSERVABILITY
```

Fail fast on missing required production variables.

---

# 141. SECRET MANAGEMENT

Never commit:

```text .env
keys
tokens
private URLs
API credentials
certificates
```

Provide `.env.example`.

---

# 142. DOCKER

Local:

```text
docker compose up
```

should provide at minimum:

```text
web
postgres
```

Add other services only if necessary.

Do not start ten containers for development.

---

# 143. STARTUP

Create simple developer workflow:

```text
pnpm install
pnpm dev
```

and:

```text
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
```

If helpful create one root command:

```text
pnpm nexus dev
pnpm nexus test
pnpm nexus check
```

Do not require complicated shell scripts.

---

# 144. CI

CI should check:

```text
install
lint
typecheck
unit tests
integration tests
build
e2e smoke
```

Run security checks where practical.

---

# 145. QUALITY GATES

A feature is NOT finished if:

- UI exists but API does not work;
- API exists but auth is broken;
- database migration missing;
- validation missing;
- error state missing;
- mobile broken;
- E2E not validated;
- docs absent for non-obvious architecture.

---

# 146. TEST STRATEGY

Do not chase meaningless test-count.

Test business invariants.

Examples:

```text duplicate email rejected
unauthorized product modification rejected
license cannot be issued without valid purchase
revoked license not accepted
payment webhook idempotent
order cannot complete twice
admin-only operation blocked for normal user
private asset inaccessible without entitlement
```

---

# 147. UNIT TESTS

Test pure domain logic:

- permission policies;
- state transitions;
- pricing;
- entitlement;
- URL resolution;
- storage routing;
- event mapping.

---

# 148. INTEGRATION TESTS

Test:

```text DB
auth
storage adapter
commerce
licensing
moderation
notifications
```

---

# 149. E2E

Critical journeys:

### Registration

```text register
verify
login
logout
```

### Developer

```text create profile
create product
upload build
publish
```

### Buyer

```text browse
product
checkout
license
account
```

### Server

```text register server
view dashboard
configure visibility
```

### Admin

```text moderation
approve
reject
suspend
```

---

# 150. BROWSER VALIDATION

After implementation:

- run Playwright;
- inspect console errors;
- inspect network failures;
- inspect hydration errors;
- inspect accessibility;
- inspect broken navigation;
- test refresh/deep links.

Do NOT declare success from unit tests alone.

---

# 151. VISUAL QA

Use screenshots for major public pages.

Check:

```text desktop 1440+
desktop 1920
laptop
tablet
mobile
```

Verify:

- spacing;
- density;
- card consistency;
- sidebar;
- topbar;
- focus;
- dark mode;
- empty states;
- loading;
- errors.

---

# 152. PERFORMANCE

Optimize:

- server rendering;
- payload size;
- image optimization;
- code splitting;
- database queries;
- N+1 queries;
- unnecessary client JS.

Do not optimize using undocumented hacks.

Measure before changing architecture.

---

# 153. CORE WEB VITALS

Track:

- LCP;
- INP;
- CLS.

Avoid huge JS bundles.

Do not ship client components unnecessarily.

---

# 154. IMAGES

Use modern image formats.

Use Next image optimization where beneficial.

Do not load giant source image when thumbnail is enough.

---

# 155. TABLES

For admin/data-heavy interfaces use reusable DataTable.

Support:

- sorting;
- filtering;
- pagination;
- row actions;
- bulk actions where safe.

Don't create custom table implementations 15 times.

---

# 156. FORM UX

Every important form should have:

- labels;
- validation;
- server errors;
- pending state;
- success state;
- retry;
- unsaved-change handling where appropriate.

---

# 157. FILE UPLOAD UX

Show:

```text
upload progress
validation
processing
ready
failed
```

Don't make upload feel like a synchronous page submit.

---

# 158. PRODUCT CREATION FLOW

Minimum:

```text
Create Product
↓
Metadata
↓
Category
↓
Pricing
↓
License model
↓
Assets
↓
Build
↓
Draft
↓
Publish
```

Avoid excessive wizard steps if they can be consolidated.

---

# 159. ARTICLE CREATION FLOW

```text
Create
↓
Write
↓
SEO
↓
Preview
↓
Draft
↓
Publish
```

---

# 160. SERVER CREATION FLOW

```text
Create Server
↓
Identity
↓
Public profile
↓
Visibility
↓
Module connection foundation
```

---

# 161. HOME PAGE

Home should feel alive.

Sections can include:

```text
trending servers
latest updates
new products
featured developers
articles
community activity
```

But use content prioritization.

Don't show 30 widgets simultaneously.

---

# 162. EXPLORE PAGE

Unified discovery.

Tabs/filters:

```text
Everything
Servers
Products
Developers
Articles
Services
```

---

# 163. SERVER CARD

Compact:

```text
name
status
online
peak
category
language
verified
```

---

# 164. PRODUCT CARD

```text
cover
name
author
type
price
verification
update date
```

---

# 165. DEVELOPER CARD

```text
avatar
name
verification
products
followers
specialization
```

---

# 166. ARTICLE CARD

```text
cover
title
author
category
date
views
```

Use same design language across cards.

---

# 167. FEED CARD

Must support context:

```text
Alex released Vehicle Pack 4.2
```

with target entity links.

---

# 168. MOBILE UX

At mobile:

- compact bottom navigation or simplified navigation where appropriate;
- sheet/drawer for secondary sections;
- tables become cards;
- large dashboards become sections.

Do not cram desktop sidebar onto mobile.

---

# 169. INTERNATIONALIZATION

Initial UI:

```text
ru
en
```

Use proper i18n architecture.

Do not bake Russian strings into components.

User-generated content stays as authored.

---

# 170. DATE / NUMBER / CURRENCY

Use locale-aware formatting.

Do not manually concatenate currency strings.

---

# 171. TIMEZONE

Store timestamps consistently in UTC/database timezone-safe representation.

Render in user locale/timezone where appropriate.

---

# 172. SLUGS

Slugs need:

- uniqueness;
- collision handling;
- normalization;
- reserved words.

Never let arbitrary input become route SQL.

---

# 173. SECURITY HEADERS

Configure appropriate modern security headers.

Evaluate:

```text
CSP
HSTS
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Frame policies
```

Don't use a copied ancient CSP that breaks the application.

---

# 174. CSP

Use strict policy appropriate for actual dependencies.

Document exceptions.

Do not use:

```text
unsafe-eval
unsafe-inline
```

unless truly required and explicitly justified.

---

# 175. SSRF

Any feature that fetches arbitrary URL must have SSRF protection.

This includes future:

- image import;
- webhook test;
- external storage;
- URL preview.

Never allow requests to:

```text
localhost
127.0.0.1
metadata endpoints
private network ranges
```

without explicit secure handling.

---

# 176. OPEN REDIRECTS

Validate all redirects.

Never use user-provided redirect URLs blindly.

---

# 177. XSS

Rich article content is dangerous.

Use safe editor/output pipeline.

Sanitize HTML/markdown according to current security guidance.

Do not render raw HTML blindly.

---

# 178. USERNAME / SLUG ABUSE

Reserve system usernames and slugs:

```text admin
api
login
settings
servers
products
articles
```

---

# 179. ABUSE / SPAM

Rate limit:

- registration;
- comments;
- reviews;
- reports;
- article publishing;
- uploads;
- messages.

Add moderation flags.

---

# 180. BOT PROTECTION

For abuse-prone public endpoints use appropriate bot protection, but don't destroy UX for normal users.

---

# 181. SECURITY EVENTS

Audit:

```text login
failed_login
password_change
2fa_change
oauth_link
api_key_create
license_revoke
ownership_change
payout
admin_action
```

---

# 182. API KEYS FUTURE FOUNDATION

API key entity should support:

```text prefix
hash
scopes
created_at
expires_at
revoked_at
last_used_at
```

Never store reusable API secret plaintext.

Only display secret once where appropriate.

---

# 183. BILLING SETTINGS

User/organization billing:

```text subscriptions
invoices
payment methods
transactions
```

Actual provider-specific data behind abstraction.

---

# 184. REVENUE REPORTING

For developer/studio:

```text sales
revenue
pending
completed
refunds
fees
```

Never fabricate metrics.

---

# 185. MONETIZATION ARCHITECTURE

Possible future revenue:

```text marketplace commission
service/deal commission
advertising
storage
protection
premium analytics
studio subscription
API usage
managed infrastructure
enterprise
```

Do not force all into 1.0.

Schema must not block them.

---

# 186. PLAN / FEATURE FLAGS

Create feature flag abstraction:

```text market
articles
new_feed
advanced_ads
module_v2
```

Allow:

- global;
- environment;
- user;
- organization.

Do not hardcode feature flags in UI.

---

# 187. RELEASE STRATEGY

Support:

```text development
staging
production
```

Do not make production depend on developer-only features.

---

# 188. DATABASE BACKUPS

Document:

- frequency;
- storage;
- encryption;
- restoration procedure.

Provide local dev backup/restore command.

---

# 189. DISASTER RECOVERY

Document:

```text database loss
storage failure
provider outage
secret rotation
rollback
restore
```

Do not claim disaster recovery unless tested.

---

# 190. HEALTH ENDPOINTS

Need:

```text /api/health
/api/ready
```

Differentiate:

```text process alive
dependencies ready
```

Never expose sensitive details publicly.

---

# 191. SYSTEM STATUS

Internal admin can see:

```text database
storage
jobs
email
payments
```

Status page can expose only safe public statuses.

---

# 192. DOCUMENTATION

Write docs while implementing.

Required:

```text README
STACK
ARCHITECTURE
DATA_MODEL
SECURITY
AUTH
STORAGE
API
DEPLOYMENT
DEVELOPMENT
```

Documentation must describe actual implementation, not desired future behavior.

---

# 193. CODE STYLE

Use:

- strict TypeScript;
- no unnecessary `any`;
- explicit naming;
- small cohesive functions;
- clear module boundaries;
- no god classes;
- no giant 3000-line components.

---

# 194. TYPESCRIPT

Enable strict mode.

Prefer:

```text unknown
```

over unsafe any.

Validate unknown external data using Zod.

Do not typecast your way out of errors.

Avoid:

```ts
as any
```

unless explicitly justified.

---

# 195. IMPORT BOUNDARIES

Domain code must not import UI.

UI may call application/domain APIs.

Database package should not know Next.js.

Storage package should not know React.

---

# 196. CIRCULAR DEPENDENCIES

Avoid completely.

Use dependency inversion if needed.

---

# 197. ERROR CODES

Create centralized application error codes.

Examples:

```text AUTH_INVALID_CREDENTIALS
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
LICENSE_EXPIRED
LICENSE_REVOKED
PRODUCT_NOT_PUBLISHED
UPLOAD_INVALID
STORAGE_UNAVAILABLE
PAYMENT_FAILED
```

---

# 198. SECURITY-CRITICAL CODE

Add comments only where they explain why something is non-obvious.

Do not create verbose commentary everywhere.

---

# 199. THIRD-PARTY PACKAGES

Before adding a package ask:

1. Is it necessary?
2. Does framework already provide this?
3. Does current ecosystem already solve it?
4. Is package actively maintained?
5. Is bundle/runtime cost justified?
6. Is license compatible?
7. Is there a security concern?

Prefer fewer dependencies.

---

# 200. PACKAGE HEALTH

For every critical dependency verify:

- latest release;
- maintenance;
- security;
- license;
- compatibility;
- official recommendation.

Record important decisions in `STACK.md`.

---

# 201. NO PREMATURE TECHNOLOGY

Do NOT add merely because it sounds advanced:

- Kubernetes;
- Kafka;
- Elasticsearch;
- Redis;
- GraphQL;
- microservices;
- event sourcing everywhere;
- CQRS everywhere;
- vector databases;
- service mesh;
- cloud orchestration.

Every infrastructure component must have a concrete requirement.

---

# 202. DATABASE-FIRST BUSINESS INTEGRITY

Anything involving:

- money;
- licensing;
- ownership;
- permissions;

must have database-backed integrity.

Application checks alone are insufficient.

---

# 203. OWNERSHIP TRANSFERS

Future-ready model should support ownership changes.

Audit:

```text old owner
new owner
actor
reason
timestamp
```

---

# 204. ORGANIZATION MEMBERSHIP

Membership state:

```text invited
active
suspended
removed
```

Audit all changes.

---

# 205. INVITATIONS

Organization/team invitation:

```text token
expires
role
organization
invited email
accepted at
```

Tokens hashed where appropriate.

---

# 206. COMMENTS

Comments:

```text author
body
target
created
edited
deleted
moderation state
```

Rate limited.

---

# 207. REACTIONS

Use generic reaction system.

Do not create separate tables for every content type if one model is enough.

---

# 208. FOLLOWS

Generic follow relation:

```text user
target_type
target_id
```

with proper indexes and constraints.

---

# 209. VIEWS / ANALYTICS

Do not update massive counters synchronously on every request if avoidable.

Use events/aggregation for scale.

At small scale simple counters are acceptable if atomic.

---

# 210. BUSINESS EVENTS

Examples:

```text product_viewed
product_purchased
server_viewed
article_viewed
developer_followed
```

Use these for future analytics.

Do not store unnecessary PII.

---

# 211. RETENTION

Analytics should avoid collecting data that isn't useful.

Respect privacy.

---

# 212. ADMIN SEARCH

Admin needs global search:

```text user
email
server
product
order
license
report
```

Use fast indexed search.

---

# 213. AUDIT SEARCH

Filter by:

```text actor
action
target
date
```

---

# 214. SUPPORT SYSTEM FOUNDATION

Support ticket model:

```text ticket
product
user
server
priority
status
messages
attachments
```

Can support future paid support.

---

# 215. FILE ATTACHMENTS IN SUPPORT

Use same Storage abstraction.

Do not invent another upload infrastructure.

---

# 216. CONTENT MODERATION

Article/comment/review moderation must use same moderation case engine.

---

# 217. NOTIFICATION DELIVERY

Every notification should have status:

```text pending
delivered
failed
read
```

---

# 218. DIGEST

Future-ready architecture for:

```text daily
weekly
```

digests.

---

# 219. DISCORD / TELEGRAM

Architecture should allow adapter-based integrations.

Do not hardwire domain logic to Discord.

---

# 220. WEBHOOK / INTEGRATION EVENTS

Every external integration should use provider adapters.

---

# 221. BRANDING

Product branding:

```text MTA Nexus
```

Sub-products:

```text Nexus Market
Nexus Secure
Nexus Module
Nexus Servers
Nexus Deals
Nexus Studio
```

Do not revert to MTA Market as the primary umbrella brand.

---

# 222. PRODUCT POSITIONING

The frontend should communicate:

> Nexus is the infrastructure for MTA projects.

Not:

> Nexus is another forum.

---

# 223. PUBLIC HOME COPY

Use strong concise statements.

Examples of concepts:

```text
Build.
Protect.
Sell.
Run.
Grow.
```

But avoid generic AI marketing garbage.

---

# 224. NO EMOJI-DRIVEN UI

The product should look professional.

Use icons, labels, badges, typography.

---

# 225. ADMIN UX

Admin should be compact and information-dense.

No marketing-style giant cards for every statistic.

---

# 226. USER UX

Users should not see system complexity unless necessary.

Progressive disclosure.

Contextual navigation.

---

# 227. PRIMARY USER LOOPS

Nexus 1.0 must optimize these:

### Developer

```text register
→ create profile
→ publish product
→ upload build
→ sell
```

### Buyer

```text discover
→ inspect
→ buy
→ receive license
```

### Server Owner

```text register
→ create server
→ dashboard
→ publish updates
```

### Reader

```text article
→ developer
→ product/server
```

---

# 228. PRIMARY BUSINESS LOOP

```text developer
→ product
→ discovery
→ purchase
→ license
→ server
→ update
→ feed
→ new user
```

---

# 229. SECONDARY BUSINESS LOOP

```text server
→ advertisement
→ discovery
→ players
→ community
```

---

# 230. FUTURE BUSINESS LOOP

```text server
→ request
→ developer
→ deal
→ escrow
→ delivery
→ review
→ reputation
```

---

# 231. MVP COMPLETION CRITERIA

Nexus 1.0 is complete only when these work end-to-end:

## Identity

- register;
- login;
- email verification;
- password reset;
- Discord;
- logout;
- session management;
- 2FA foundation.

## Public

- home;
- explore;
- search;
- servers;
- developers;
- products;
- articles.

## Developer

- profile;
- product creation;
- asset upload;
- build creation;
- draft;
- publish.

## Buyer

- product page;
- checkout;
- order;
- license;
- downloads/access.

## Server

- server registration;
- public page;
- dashboard;
- visibility controls.

## Content

- article creation;
- publish;
- feed integration;
- comments;
- reactions.

## Admin

- users;
- products;
- content;
- servers;
- reports;
- moderation;
- audit.

## Storage

- abstraction;
- upload;
- processing;
- checksums;
- provider routing.

## System

- notifications;
- audit;
- health;
- errors;
- logging.

---

# 232. FEATURES NOT REQUIRED FOR 1.0

Do not fully implement unless architecture requires foundations:

```text advanced escrow
full freelancer marketplace
API marketplace
hosting marketplace
enterprise
advanced creator campaign platform
project crowdfunding
auction system
full staging/deployment
advanced server automation
complete asset anti-dump runtime
Nexus Module native implementation
advanced recommendation ML
```

They must not block the 1.0 architecture.

---

# 233. BUT PREPARE EXTENSION POINTS

Prepare interfaces and data model for:

```text PaymentProvider
StorageProvider
NotificationProvider
SearchProvider
MalwareScanner
DeploymentProvider
ModuleProtocol
```

---

# 234. TEST DATA

Seed enough realistic content to make the application look alive:

```text 20 servers
15 developers
30 products
40 articles
orders
licenses
reviews
notifications
```

Use fictional entities.

---

# 235. FINAL DESIGN REVIEW

Before calling project complete, inspect every major page visually.

Ask:

- Is there unnecessary whitespace?
- Is the topbar useful?
- Is sidebar compact?
- Are cards consistent?
- Are actions obvious?
- Are errors understandable?
- Does desktop look premium?
- Does mobile remain usable?
- Is dark mode coherent?

---

# 236. FINAL SECURITY REVIEW

Check:

- auth bypass;
- IDOR;
- privilege escalation;
- CSRF;
- XSS;
- SSRF;
- upload abuse;
- path traversal;
- SQL injection;
- webhook replay;
- race conditions;
- double payment;
- duplicate license;
- unauthorized file access;
- exposed secrets.

---

# 237. FINAL PERFORMANCE REVIEW

Check:

- N+1 queries;
- unnecessary client JS;
- giant payloads;
- duplicated fetching;
- missing indexes;
- image sizes;
- expensive server components;
- slow admin queries.

---

# 238. FINAL DEPENDENCY REVIEW

Run current package/dependency audit.

Check vulnerabilities.

Verify that all important packages are current and compatible.

Do not blindly upgrade unrelated packages at the end.

---

# 239. FINAL DOCUMENTATION REVIEW

Ensure docs describe the actual repository.

No stale architecture diagrams.

No fictitious services.

No “future” functionality presented as implemented.

---

# 240. AGENT WORKFLOW

You MUST work in phases.

## Phase 0 — Research

- current ecosystem;
- current package versions;
- official docs;
- architecture decisions.

Output:

```text
docs/STACK.md
docs/DECISIONS.md
```

---

## Phase 1 — Bootstrap

Create:

- monorepo;
- Next.js;
- TypeScript;
- Tailwind;
- shadcn;
- Base UI;
- lint;
- format;
- tests;
- Docker;
- env validation.

Run:

```text
install
lint
typecheck
test
build
```

---

## Phase 2 — Core Architecture

Implement:

- config;
- db;
- domain;
- validation;
- errors;
- authorization;
- event system;
- audit.

---

## Phase 3 — Identity

Implement:

- auth;
- profile;
- sessions;
- roles;
- organizations;
- 2FA foundation.

---

## Phase 4 — Catalog

Implement:

- servers;
- developers;
- products;
- assets;
- builds.

---

## Phase 5 — Commerce

Implement:

- orders;
- checkout foundation;
- payment provider abstraction;
- licenses;
- entitlements.

---

## Phase 6 — Content

Implement:

- articles;
- posts;
- comments;
- reactions;
- follow;
- feed.

---

## Phase 7 — Discovery

Implement:

- search;
- explore;
- trending;
- related content;
- personalized home foundation.

---

## Phase 8 — Admin

Implement:

- moderation;
- reports;
- users;
- products;
- servers;
- audit;
- system health.

---

## Phase 9 — Storage

Implement:

- upload;
- storage abstraction;
- provider adapter;
- checksum;
- processing pipeline.

---

## Phase 10 — UX Polish

Implement:

- responsive;
- light/dark;
- command palette;
- loading;
- empty;
- errors;
- accessibility;
- visual polish.

---

## Phase 11 — QA

Run:

```text
lint
typecheck
unit
integration
e2e
build
```

Then manual browser inspection.

---

## Phase 12 — SECURITY AUDIT

Perform adversarial review.

Attempt:

```text
unauthorized access
IDOR
privilege escalation
fake ownership
license bypass
upload abuse
payment replay
webhook replay
```

---

## Phase 13 — RELEASE

Prepare:

```text
README
DEPLOYMENT
ENV
DATABASE migrations
backup
rollback
health checks
production build
```

---

# 241. AGENT BEHAVIOR RULES

Never:

- fake functionality;
- silently skip errors;
- hide failing tests;
- disable type checking;
- disable lint to make build pass;
- weaken security to simplify implementation;
- create dummy payment success;
- hardcode admin access;
- store secret values in client;
- return fake analytics;
- claim a feature works without testing it.

---

# 242. WHEN SOMETHING IS UNCLEAR

Do not stop the implementation for a minor ambiguity.

Choose the most maintainable architecture that fits the documented goals.

If the ambiguity changes security, financial correctness, data ownership, or legal behavior, stop that specific implementation and record a decision in:

```text
docs/DECISIONS.md
```

Do not invent external provider capabilities.

---

# 243. WHEN A LIBRARY IS DEPRECATED

Do not keep using it merely because a tutorial uses it.

Research current official replacement.

Update architecture.

Record reason.

---

# 244. WHEN A NEW FRAMEWORK VERSION APPEARS

Before adopting:

1. read release notes;
2. check migration guide;
3. inspect compatibility;
4. assess security;
5. update lockfile;
6. run tests;
7. record result.

---

# 245. WHEN A PACKAGE HAS SECURITY VULNERABILITY

Prioritize remediation.

Do not hide it.

Do not silence audit warnings without documented reason.

---

# 246. CODING STYLE FOR THE AGENT

Prefer boring, reliable code over clever code.

Use abstractions only when they reduce complexity.

A 30-line straightforward function is better than a 200-line generic framework.

---

# 247. ARCHITECTURE PRINCIPLE

Every new feature should answer:

> Which existing entities and mechanisms can this feature reuse?

Prefer:

```text existing entity
+
event
+
entitlement
+
content
+
order
```

over creating an entirely new subsystem.

---

# 248. EXAMPLE

Jobs should eventually reuse:

```text User
Organization
Service/Product
Deal
Content
Notification
Payment
Review
```

API marketplace should reuse:

```text Product
License
Entitlement
Subscription
Payment
Analytics
```

Ads should reuse:

```text Product/Server/Developer/Article
Order
Payment
Analytics
```

Do not duplicate systems.

---

# 249. DEFINITION OF DONE

Feature is complete when:

```text
database
+
domain logic
+
authorization
+
validation
+
API
+
UI
+
loading
+
error handling
+
tests
+
docs
```

are all coherent.

---

# 250. FINAL OUTPUT FROM AGENT

At completion, provide:

## 1. Architecture Summary

What was built.

## 2. Repository Map

Important directories.

## 3. Stack Versions

Exact installed versions from lockfile.

## 4. Implemented Features

Only actually implemented features.

## 5. Deferred Features

Clearly separated future work.

## 6. Security Review

What was checked.

## 7. Test Summary

Unit/integration/E2E/build results.

## 8. Known Limitations

No hiding.

## 9. Run Commands

Exact commands.

## 10. Deployment Instructions

Production setup.

## 11. Next Recommended Phase

Only after Nexus 1.0 is stable.

---

# 251. ABSOLUTE FINAL PRINCIPLE

Build MTA Nexus as:

```text
SMALL CORE
+
STRONG DOMAIN MODEL
+
REUSABLE SYSTEMS
+
PROFESSIONAL UX
+
SECURITY
+
EXTENSION POINTS
```

Do NOT build:

```text
GIANT MONOLITH OF FEATURES
```

The goal is:

```text
Huge ecosystem on the outside
Small, coherent architecture on the inside.
```

Nexus 1.0 should feel like a mature platform even though it is the first release.

The user should experience:

```text
Discover
→ Create
→ Buy
→ License
→ Publish
→ Follow
→ Manage
```

while the codebase remains:

```text
modular
typed
tested
documented
secure
compact
```

END OF MASTER PROMPT.