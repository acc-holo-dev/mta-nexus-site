# PLAN-002 — MTA Nexus 1.1
## Nexus Core: переход от Prototype к реальной платформе

**Статус:** Planned  
**Версия:** Nexus 1.1  
**Предыдущая версия:** Nexus 1.0  
**Репозиторий:** `acc-holo-dev/mta-nexus-site`  
**Branch:** `main`

---

## 1. Цель

Превратить текущее состояние MTA Nexus 1.0 из архитектурного prototype в реальное рабочее ядро платформы.

Nexus 1.1 не добавляет десятки новых функций.

Основная задача версии:

> **Убрать mock/runtime-заглушки и перевести уже существующие подсистемы на реальное состояние приложения.**

После завершения PLAN-002:

```text
Nexus 1.0
Prototype / Mock State
        ↓
Nexus 1.1
Real Core Platform
        ↓
PostgreSQL
Real Auth
Real Sessions
Real Authorization
Real Storage
Real Products
Real Builds
Real Licenses
Real Entitlements
Real Orders
Real Ledger
Real Admin
```

---

# 2. Текущее состояние

На момент начала PLAN-002 проект уже содержит:

- Next.js App Router;
- pnpm workspace;
- package-based modular monolith;
- `@nexus/domain`;
- `@nexus/db`;
- `@nexus/security`;
- `@nexus/storage`;
- `@nexus/validation`;
- `@nexus/config`;
- `@nexus/ui`;
- PostgreSQL schema;
- продукты;
- builds;
- licenses;
- entitlements;
- orders;
- payments;
- ledger;
- content;
- comments;
- follows;
- notifications;
- server installations;
- admin UI;
- marketplace UI;
- server UI;
- articles UI.

Но основная часть runtime ещё работает через in-memory `NexusDataStore` и `mock-data.ts`.

Следовательно, архитектура уже существует, однако persistence и production runtime ещё не соединены.

---

# 3. Главный принцип PLAN-002

Запрещено расширять платформу новыми крупными подсистемами до завершения перехода на реальное состояние.

Не делать сейчас:

- новые marketplace-разделы;
- escrow;
- freelance marketplace;
- API marketplace;
- hosting marketplace;
- creator marketplace;
- полноценную социальную сеть;
- сложную recommendation engine;
- микросервисы;
- Redis без реальной необходимости;
- Elasticsearch;
- отдельный backend service;
- сложную event infrastructure.

Сначала должен стать настоящим существующий Core.

---

# 4. Архитектурная цель

Сохранить modular monolith.

```text
apps/web
    │
    ├── App Router
    ├── Pages
    ├── API Routes
    └── UI
          │
          ▼
      Application Services
          │
          ├── Auth
          ├── Users
          ├── Products
          ├── Servers
          ├── Licensing
          ├── Orders
          ├── Payments
          ├── Content
          └── Admin
          │
          ▼
        Domain
          │
          ▼
      PostgreSQL / Storage
```

`apps/web` остаётся control plane.

Будущий Nexus Module не должен становиться частью web business logic.

---

# 5. TASK-001 — Удалить runtime dependency от mock store

### Цель

Перестать использовать `NexusDataStore` как основной источник данных.

### Необходимо

Провести аудит всех импортов:

```ts
from "./store"
from "../lib/services/store"
mock-data
initialUsers
initialProducts
initialServers
initialLicenses
```

Каждый production path должен быть переведён на repository/database layer.

### Допустимо

Оставить seed mechanism для локальной разработки.

### Недопустимо

Чтобы production service делал:

```ts
store.users.get(...)
store.products.get(...)
Array.from(store.products.values())
```

---

# 6. TASK-002 — Реальный PostgreSQL runtime

Подключить `@nexus/db` к application services.

Создать единый database access layer.

Минимальная схема:

```text
packages/db/
├── src/
│   ├── client.ts
│   ├── schema.ts
│   ├── repositories/
│   │   ├── users.ts
│   │   ├── organizations.ts
│   │   ├── servers.ts
│   │   ├── products.ts
│   │   ├── builds.ts
│   │   ├── licenses.ts
│   │   ├── orders.ts
│   │   ├── payments.ts
│   │   ├── content.ts
│   │   └── audit.ts
│   └── index.ts
```

Repository layer не должен содержать UI logic.

---

# 7. TASK-003 — Database migrations

Настроить нормальный migration workflow.

Требования:

```bash
pnpm db:generate
pnpm db:migrate
```

 должны работать против реальной PostgreSQL.

Добавить:

```text
schema
↓
migration
↓
database
```

Никаких ручных изменений production database.

---

# 8. TASK-004 — Seed system

Создать отдельный development seed.

Например:

```text
packages/db/src/seed.ts
```

Seed должен создавать:

- admin;
- developer;
- server owner;
- player;
- organization;
- demo servers;
- demo products;
- demo builds;
- demo licenses;
- demo content.

При этом seed не должен смешиваться с application runtime.

Production приложение не должно автоматически загружать `mock-data.ts`.

---

# 9. TASK-005 — Настоящая регистрация

Регистрация должна работать через PostgreSQL.

Flow:

```text
POST /api/auth/register
        ↓
validation
        ↓
database lookup
        ↓
password hashing
        ↓
create user
        ↓
create session
        ↓
set secure cookie
```

Проверять:

- email uniqueness;
- username uniqueness;
- password policy;
- duplicate registration;
- malformed data;
- race conditions при uniqueness.

---

# 10. TASK-006 — Настоящий login

Устранить текущий demonstration login flow.

Login обязан:

```text
email
+
password
        ↓
find user
        ↓
verifyPassword()
        ↓
session creation
```

Нельзя считать login успешным только из-за существования email.

---

# 11. TASK-007 — Session system

Перевести sessions на PostgreSQL.

Минимум:

```text
Session
- id
- userId
- tokenHash
- expiresAt
- createdAt
- ipAddress
- userAgent
```

Не хранить session token в открытом виде в database, если architecture допускает безопасное hash-based хранение.

Добавить:

- expiration;
- logout;
- invalidation;
- session lookup;
- session cleanup;
- multiple sessions per account.

---

# 12. TASK-008 — Authorization

Проверить существующий `can()` policy engine и перевести его на реальное состояние пользователя/organization/context.

Поддержать:

```text
user
developer
server_owner
moderator
admin
organization roles
permissions
context
```

Особенно проверить:

```text
product.create
build.release
product.manage
server.manage
license.manage
admin.*
```

Нельзя доверять роли, пришедшей от клиента.

Authorization должна выполняться server-side.

---

# 13. TASK-009 — Context switching

Текущий `activeContextId` должен перестать быть просто полем в mock user.

Создать реальное понятие:

```text
Personal
Organization
Server
Project
```

На данном этапе реализовать минимум:

```text
Personal
Organization
```

Контекст должен определяться server-side.

Нельзя разрешать пользователю просто указать чужой `contextId`.

---

# 14. TASK-010 — Products

Перевести marketplace products на PostgreSQL.

Поддержать:

```text
Create
Read
Update
Publish
Unpublish
Archive
```

Product должен иметь:

- author;
- organization;
- type;
- price;
- currency;
- license model;
- tags;
- compatibility;
- status;
- versions/builds;
- statistics.

---

# 15. TASK-011 — Product search

Пока не добавлять Elasticsearch.

Использовать PostgreSQL.

Минимально:

```text
title
description
tags
type
price
status
```

Сделать нормальные:

```text
newest
popular
rating
price_asc
price_desc
relevance
```

`relevance` должен реально существовать, а не просто называться relevance.

---

# 16. TASK-012 — Builds

Build должен быть полноценной сущностью.

Поддержать:

```text
Draft
Testing
Published
Deprecated
Retired
```

Связь:

```text
Product
   └── Build 1
   └── Build 2
   └── Build 3
```

Обязательно обеспечить уникальность:

```text
productId + version
```

---

# 17. TASK-013 — Storage Core

Оставить abstraction:

```ts
StorageProvider
```

но сделать реальную реализацию.

Минимум:

```text
LocalStorageProvider
S3StorageProvider
```

Interface должен поддерживать:

```text
put
get
delete
exists
stat
```

Для больших файлов предусмотреть streaming.

---

# 18. TASK-014 — Storage ownership

Application code не должен решать:

```text
"./uploads/file.zip"
```

или напрямую выбирать физический backend.

Вместо этого:

```text
Asset
  ↓
Storage service
  ↓
Storage policy
  ↓
Provider
```

Подготовить архитектуру для:

```text
Local
S3
Yandex Disk
Mirror
Backup
```

но пока реализовать только необходимые providers.

---

# 19. TASK-015 — Asset integrity

Каждый uploaded asset должен иметь:

```text
SHA-256
size
mime
original filename
storage key
owner
status
```

Добавить проверки:

- size limits;
- MIME validation;
- extension validation;
- checksum;
- duplicate detection;
- private/public state.

---

# 20. TASK-016 — Licensing Core

Сделать licenses реальными database records.

Поддержать:

```text
license
product
user
server
status
expiration
entitlements
```

Flow:

```text
Purchase
   ↓
Order completed
   ↓
License created
   ↓
Entitlement created
```

Не создавать license просто потому, что frontend сообщил об успешной покупке.

---

# 21. TASK-017 — Entitlement Engine

Создать единый server-side механизм:

```ts
hasEntitlement(subject, resource, permission)
```

Примеры:

```text
product.download
product.update
module.protected_asset
module.runtime
module.api
server.install
```

В дальнейшем именно эта подсистема станет основанием для Nexus Module.

---

# 22. TASK-018 — Orders

Перевести orders на PostgreSQL.

Статусы должны быть явной state machine:

```text
pending
processing
completed
cancelled
refunded
```

Нельзя разрешать произвольный переход:

```text
cancelled → completed
```

без предусмотренного правила.

---

# 23. TASK-019 — Payment Core

В Nexus 1.1 не требуется подключать новый внешний payment provider.

Создать корректный внутренний abstraction:

```text
PaymentProvider
```

и привести database/payment state machine в готовое состояние.

До появления реального provider:

```text
Mock/Test Payment Provider
```

может существовать только явно как development implementation.

---

# 24. TASK-020 — Ledger

Сохранить идею append-only ledger.

Проверить:

- отсутствие UPDATE старых financial entries;
- отсутствие DELETE;
- atomic transaction;
- reference;
- currency;
- balance consistency;
- duplicate operation protection.

Любое финансовое изменение должно быть транзакционным.

---

# 25. TASK-021 — Admin

Admin panel перевести с mock store на реальные данные.

Admin должен видеть:

```text
Users
Servers
Products
Orders
Licenses
Reports
Audit events
```

Минимум:

```text
search
filter
view
status
```

Административные действия должны проходить через authorization layer.

---

# 26. TASK-022 — Audit system

Каждое критическое действие должно создавать audit event.

Минимум:

```text
LOGIN
LOGOUT
USER_CREATED
PRODUCT_CREATED
PRODUCT_PUBLISHED
BUILD_RELEASED
LICENSE_CREATED
LICENSE_REVOKED
ORDER_CREATED
PAYMENT_COMPLETED
ADMIN_ACTION
PERMISSION_CHANGED
```

Audit event должен содержать:

```text
actor
action
target
timestamp
ip
metadata
```

---

# 27. TASK-023 — Security audit

Провести проверку:

### Authentication

- password verification;
- session expiration;
- session invalidation;
- cookie settings.

### Authorization

- IDOR;
- privilege escalation;
- organization isolation;
- server ownership;
- product ownership.

### Uploads

- dangerous file types;
- path traversal;
- oversized files;
- spoofed MIME;
- unauthorized download.

### API

- validation;
- malformed JSON;
- rate limiting;
- duplicate requests;
- error leakage.

### Database

- foreign keys;
- uniqueness;
- transactions;
- cascade rules.

---

# 28. TASK-024 — API consistency

Привести API к единому стилю.

Пример:

```text
GET    /api/products
GET    /api/products/:id
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id
```

Для actions:

```text
POST /api/products/:id/publish
POST /api/products/:id/archive
```

Не смешивать случайным образом:

```text
POST /status
PATCH /status
```

для одной и той же операции.

---

# 29. TASK-025 — Error system

Использовать единый error model.

Минимум:

```text
400 ValidationError
401 Unauthorized
403 Forbidden
404 NotFound
409 Conflict
429 RateLimited
500 Internal
```

Не отдавать клиенту stack trace или внутренние исключения.

---

# 30. TASK-026 — Remove demo bypasses

Полностью найти и удалить:

```text
demo admin session
hardcoded authenticated user
automatic login
mock password success
development-only authentication bypass
```

Development seed может существовать.

Authentication bypass — нет.

---

# 31. TASK-027 — UI migration

После перехода backend на реальные данные страницы должны продолжить работать.

Проверить:

```text
/
 /market
 /servers
 /developers
 /articles
 /explore
 /workspace
 /admin
 /auth/*
```

Frontend не должен знать о database layer.

---

# 32. TASK-028 — Loading / Empty / Error states

Каждый основной section должен иметь:

```text
loading
empty
error
success
```

Состояния не должны зависеть от mock data.

Например:

```text
No products
No servers
No licenses
No orders
No articles
```

должны быть нормальными состояниями интерфейса.

---

# 33. TASK-029 — Preserve Nexus visual direction

В PLAN-002 не делать полный redesign.

Но убрать очевидные prototype-признаки:

- чрезмерно большой hero;
- слишком много свободного пространства;
- демонстрационные надписи;
- технические placeholder descriptions;
- визуальную зависимость от mock data.

UI должен уже выглядеть как реальный продукт, даже если полный redesign будет отдельным PLAN.

---

# 34. TASK-030 — Tests

Тесты должны проверять не mock store, а application behavior.

Минимальный набор:

### Auth

```text
register
duplicate email
duplicate username
login correct password
login wrong password
logout
expired session
```

### Authorization

```text
user
developer
server owner
admin
organization member
```

### Products

```text
create
update
publish
release build
ownership
```

### Licensing

```text
create
revoke
expire
entitlement
```

### Orders

```text
create
complete
cancel
duplicate completion
```

### Storage

```text
upload
download authorization
checksum
delete
```

---

# 35. TASK-031 — Real integration tests

Добавить тестовый PostgreSQL environment.

Integration tests должны проходить через:

```text
API
→ Service
→ Repository
→ PostgreSQL
```

а не через:

```text
API
→ mock Map
```

---

# 36. TASK-032 — E2E Critical Path

Минимальный E2E:

```text
Register
 ↓
Login
 ↓
Open profile
 ↓
Create developer context
 ↓
Create product
 ↓
Publish product
 ↓
Open marketplace
 ↓
Open product page
```

И второй:

```text
Login
 ↓
Admin
 ↓
Inspect product
 ↓
Inspect audit event
```

---

# 37. TASK-033 — Docker environment

`compose.yaml` должен давать полностью воспроизводимый local environment:

```text
PostgreSQL
MinIO
Mailpit
```

Приложение должно стартовать без ручного создания инфраструктуры.

---

# 38. TASK-034 — Environment validation

Проверять обязательные ENV при startup.

Пример:

```text
DATABASE_URL
AUTH_SECRET
STORAGE_PROVIDER
```

Ошибочная конфигурация должна приводить к понятной ошибке startup.

---

# 39. TASK-035 — Health checks

Добавить:

```text
/api/health
/api/health/db
/api/health/storage
```

Минимальный health response:

```json
{
  "status": "ok"
}
```

При проблеме dependency response должен это отражать.

---

# 40. TASK-036 — Runtime scripts

Root package scripts привести к единой схеме:

```bash
pnpm dev
pnpm build
pnpm start
pnpm test
pnpm typecheck
pnpm lint

pnpm db:generate
pnpm db:migrate
pnpm db:seed

pnpm check
```

`pnpm check` должен запускать основные quality gates.

---

# 41. TASK-037 — Documentation synchronization

После реализации обновить:

```text
docs/ARCHITECTURE.md
docs/DATA_MODEL.md
docs/API.md
docs/AUTH.md
docs/SECURITY.md
docs/STORAGE.md
docs/DEVELOPMENT.md
```

Документация должна описывать фактическую реализацию, а не будущую архитектуру.

---

# 42. TASK-038 — Definition of Done

PLAN-002 считается завершённым только если:

### Database

- PostgreSQL используется runtime;
- migrations работают;
- seed работает;
- application не зависит от mock store.

### Auth

- registration реальный;
- login проверяет password;
- sessions реальные;
- logout работает;
- authorization работает.

### Marketplace

- products из PostgreSQL;
- builds из PostgreSQL;
- product publishing работает.

### Licensing

- licenses сохраняются;
- entitlements проверяются server-side.

### Commerce

- orders реальные;
- payment abstraction существует;
- ledger транзакционный.

### Storage

- assets реально загружаются;
- SHA-256 проверяется;
- authorization на downloads работает.

### Admin

- реальные данные;
- реальные authorization checks;
- audit records.

### Quality

```bash
pnpm check
pnpm test
pnpm build
```

должны завершаться успешно.

---

# 43. PLAN-002 End State

После завершения:

```text
                 MTA NEXUS 1.1
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     Identity       Marketplace     Servers
        │              │              │
     Sessions       Products       Ownership
     Roles           Builds         Installations
     Context         Assets         Heartbeat
        │              │              │
        └──────────────┼──────────────┘
                       │
                  Licensing
                       │
                 Entitlements
                       │
                    Orders
                       │
                   Payments
                       │
                    Ledger
                       │
                  PostgreSQL
                       │
                    Storage
```

Это становится настоящим **Nexus Core**.

---

# 44. Что НЕ входит в Nexus 1.1

Следующие вещи намеренно откладываются:

```text
Nexus Module implementation
advanced anti-dump pipeline
escrow
freelance marketplace
API marketplace
hosting marketplace
creator marketplace
advanced recommendation engine
distributed storage
Redis
microservices
Elasticsearch
complex analytics
enterprise billing
full social graph
```

Они должны строиться поверх стабильного Core, а не вместо него.

---

# 45. Критический приоритет

Порядок выполнения:

```text
1. Database runtime
2. Repositories
3. Auth
4. Sessions
5. Authorization
6. Products
7. Builds
8. Storage
9. Licensing
10. Entitlements
11. Orders
12. Ledger
13. Admin
14. Audit
15. API consistency
16. Security
17. Integration tests
18. E2E
19. Documentation
20. Release
```

---

# 46. Главный результат версии

Nexus 1.1 не должен быть «ещё больше».

Он должен быть:

> **меньше демонстрации, больше реальной системы.**

После PLAN-002 можно будет строить следующие версии уже на настоящем фундаменте, а не на mock-state.

**Target:** `Nexus 1.1 Core`
**Release condition:** production-like local environment + real PostgreSQL runtime + real auth + real storage + real marketplace/licensing/commerce core.