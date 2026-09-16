# PLAN-004 — MTA Nexus 1.3
## Nexus Platform Hardening, Trust, Monetization & Server Ecosystem

**Статус:** Planned  
**Версия:** Nexus 1.3  
**Предыдущая версия:** Nexus 1.2  
**Repository:** `acc-holo-dev/mta-nexus-site`  
**Branch:** `main`

---

# 1. Цель

Nexus 1.2 уже реализовал публичный пользовательский слой:

```text
Profiles
Organizations
Servers
Marketplace
Purchases
Licenses
Saved
Notifications
Follow
Reviews
Reports
Admin
Search / Discovery
```

Nexus 1.3 не должен просто добавлять ещё страницы.

Главная цель:

> **Превратить Nexus 1.2 в устойчивую коммерческую платформу с нормальным trust layer, серверной экосистемой, реальной монетизационной моделью и production-grade security.**

Главный переход:

```text
Nexus 1.2
Public Platform
        ↓
Nexus 1.3
Platform Hardening
        +
Trust
        +
Monetization
        +
Server Ecosystem
        +
Production UX
```

---

# 2. Что уже существует

Текущий `main` уже содержит реализацию PLAN-003.

В 1.2 были добавлены:

```text
Nexus Shell
Sidebar
Notification Bell
Public User Profiles
Organizations
Purchases
Licenses
Saved
Notifications API
Follow API
Reports API
Admin Actions API
Product Reviews
Authorized Download Flow
```

Также в repository уже существуют:

```text
Marketplace
Servers
Developers
Articles
Explore
Workspace
Admin
```

Именно это является базой 1.3.

---

# 3. Главный принцип

Не создавать новый giant subsystem без необходимости.

Сохранять:

```text
Next.js
+
Modular Monolith
+
PostgreSQL
+
Drizzle
+
Storage abstraction
+
Domain events
```

Не вводить:

```text
Microservices
Kubernetes
Redis
Elasticsearch
Kafka
RabbitMQ
```

если конкретная нагрузка ещё не требует этого.

---

# 4. TASK-001 — Полный аудит Nexus 1.2

Перед новым кодом провести audit всех функций, добавленных PLAN-003.

Проверить:

```text
Auth
Profiles
Organizations
Servers
Marketplace
Products
Builds
Purchases
Licenses
Downloads
Reviews
Follow
Saved
Notifications
Reports
Admin
Search
```

Для каждого определить:

```text
Implemented
Partially implemented
Mocked
Unsafe
Broken
Missing tests
```

После аудита удалить ложные claims о готовности.

---

# 5. TASK-002 — Устранить остаточные mock/fallback mechanisms

Найти:

```text
mock
demo
fallback
hardcoded
fake
seed-only
temporary
```

Production path не должен зависеть от них.

Особенно проверить:

```text
hardcoded IDs
hardcoded users
hardcoded products
hardcoded hashes
hardcoded statistics
hardcoded storage paths
```

Development seed остаётся отдельно.

---

# 6. TASK-003 — Secure Download Pipeline

Полностью пересобрать download flow.

Текущий flow допускает fallback-значения для build/hash/storage path и нуждается в ужесточении.

Новый flow:

```text
User
 ↓
Session
 ↓
Product
 ↓
License / Entitlement
 ↓
Specific Build
 ↓
Storage Authorization
 ↓
Signed / Controlled Delivery
```

Download должен всегда ссылаться на реальный существующий build.

Никаких:

```text
fallback hash
fallback storage key
fake latest.zip
```

---

# 7. TASK-004 — Private Storage Enforcement

Storage key никогда не должен становиться публичным URL.

Правильный принцип:

```text
Client
 ↓
Authorized API
 ↓
Authorization
 ↓
Storage Provider
 ↓
Temporary delivery
```

Пользователь не должен иметь возможность изменить storage key и получить чужой asset.

---

# 8. TASK-005 — Notification Ownership Security

Проверить все notification mutations.

Например:

```text
POST /api/notifications/mark-read
```

должен разрешать:

```text
currentUser
    ↓
only own notification
```

а не:

```text
currentUser
    ↓
notification ID
    ↓
any notification
```

Добавить authorization tests на IDOR.

---

# 9. TASK-006 — Social Target Validation

Для:

```text
Follow
Saved
Reactions
```

нельзя принимать произвольные:

```text
targetType
targetId
```

из client без проверки.

Server должен подтвердить, что target реально существует.

Допустимые target types должны быть enum/contract controlled.

---

# 10. TASK-007 — Review Integrity

Review system должен гарантировать:

```text
completed purchase
+
product ownership
+
one review per allowed purchase
```

Проверять:

```text
duplicate review
self-review
review after refund
review after revoked access
```

Определить правила изменения/удаления review.

---

# 11. TASK-008 — Trust Layer

Создать единую trust model Nexus.

Основные trust signals:

```text
Email verified
Developer verified
Organization verified
Server verified
Verified purchase
Verified review
Completed sales
Completed deals
Reported content
Moderation history
```

Не делать один magic `reputationScore`, который автоматически решает всё.

Trust должен состоять из понятных сигналов.

---

# 12. TASK-009 — Verification System

Подготовить:

```text
User verification
Developer verification
Organization verification
Server verification
```

Admin workflow:

```text
Request
 ↓
Review
 ↓
Approve / Reject
 ↓
Audit event
```

Verification не должна быть просто boolean, который можно выставить напрямую через API.

---

# 13. TASK-010 — Public Reputation

В public profiles показывать только безопасные агрегаты:

```text
Products
Sales
Rating
Reviews
Verification
Activity
```

Не показывать внутреннюю moderation history.

---

# 14. TASK-011 — Scam / Abuse Protection

Расширить reports/moderation.

Типы:

```text
Scam
Copyright
Malware
Fraud
Spam
Impersonation
Abuse
```

Добавить:

```text
report status
moderator
resolution
notes
timestamps
```

---

# 15. TASK-012 — Public Blacklist Foundation

Подготовить публичный trust registry.

Объекты:

```text
User
Developer
Organization
Server
```

Статусы:

```text
warning
restricted
blocked
```

Публиковать только случаи, по которым есть завершённое moderation decision.

Никаких публичных автоматических обвинений без moderation process.

---

# 16. TASK-013 — Server Identity

Улучшить server entity.

Добавить при необходимости:

```text
region
country
website
discord
banner
logo
description
tags
game modes
```

Владелец сам определяет публичную информацию.

Не раскрывать автоматически внутренние server resources.

---

# 17. TASK-014 — Server Ownership Verification

Создать ownership verification flow.

Например:

```text
Create server
 ↓
Generate verification token
 ↓
Server owner places token / integration proof
 ↓
Nexus verifies
 ↓
Server marked verified
```

Architecture должна быть совместима с будущим Nexus Module.

Но Module в 1.3 не реализуется.

---

# 18. TASK-015 — Server Heartbeat Foundation

Подготовить server telemetry API.

Минимум:

```text
serverId
installationId
status
players
maxPlayers
version
lastHeartbeat
```

API:

```text
POST /api/server/installations/heartbeat
```

На этом этапе достаточно API foundation.

Нельзя делать ложные online statistics.

---

# 19. TASK-016 — Real Server Status

Server status должен определяться на основе heartbeat/health data.

Минимум:

```text
online
offline
maintenance
suspended
```

Не использовать hardcoded:

```text
currentPlayers: 342
```

в production records.

---

# 20. TASK-017 — Server Analytics Foundation

Подготовить данные для:

```text
Players online
Peak players
Daily activity
Uptime
```

Не делать сложный analytics platform.

Сохранять необходимые events/snapshots для будущего расширения.

---

# 21. TASK-018 — Server Updates

Владелец сервера может публиковать:

```text
Update
Announcement
Devlog
News
```

Использовать существующую Content system.

Связь:

```text
Server
 ↓
Content
 ↓
Feed
 ↓
Notifications
```

---

# 22. TASK-019 — Product Update System

Developer может публиковать:

```text
Build release
Changelog
Update
Announcement
```

После release:

```text
Build
 ↓
Event
 ↓
Follower notification
 ↓
Feed
```

Не создавать второй notification engine.

---

# 23. TASK-020 — Dependency System

Для Product добавить нормальные dependency relationships.

Например:

```text
Product A
 ↓
requires
 ↓
Product B
```

и:

```text
Nexus Module
 ↓
minimum version
```

Валидация совместимости должна быть server-side.

---

# 24. TASK-021 — License Model v2

Привести licensing к более гибкой модели.

Поддержать архитектурно:

```text
Single Server
Multiple Servers
Organization
Floating
Subscription
Perpetual
```

Но реализовывать только реально необходимые варианты.

License должна ссылаться на explicit entitlement.

---

# 25. TASK-022 — Server-bound Licensing Foundation

Подготовить:

```text
License
 ↓
Server
 ↓
Server Installation
```

При этом:

```text
User owns license
```

и:

```text
Server is entitled
```

не должны смешиваться в одну сущность.

---

# 26. TASK-023 — Monetization v1

Настоящий Nexus revenue foundation:

```text
Product sales
Platform commission
Featured placement
```

Комиссия должна рассчитываться server-side.

Пример:

```text
Product price
↓
Platform fee
↓
Seller amount
```

Все финансовые изменения:

```text
Order
Payment
Ledger
```

должны быть транзакционными.

---

# 27. TASK-024 — Seller Dashboard

Developer должен видеть:

```text
Revenue
Sales
Orders
Products
Downloads
Licenses
```

Без раскрытия чужих private data.

---

# 28. TASK-025 — Commerce History

Создать seller-side:

```text
Sales
Orders
Payout balance
```

Пока без полноценной external payout infrastructure.

---

# 29. TASK-026 — Featured Placement v2

Развить существующую featured foundation.

Поддержать:

```text
target
placement
startAt
endAt
status
```

Target:

```text
Product
Server
Developer
Organization
Article
```

Каждый paid placement:

```text
Sponsored
```

и отделён от organic discovery.

---

# 30. TASK-027 — Advertising Slots

Подготовить реальные placement zones:

```text
Homepage
Marketplace
Servers
Articles
Explore
```

Каждая зона должна иметь:

```text
placement ID
dimensions
availability
active campaign
```

Не создавать отдельный рекламный frontend app.

---

# 31. TASK-028 — Product Discovery Improvement

Improve ranking без ML.

Signals:

```text
sales
rating
freshness
engagement
follows
activity
```

Sponsored content отдельно.

Алгоритм должен быть deterministic и объяснимым.

---

# 32. TASK-029 — Explore v2

Explore:

```text
Trending
New
Popular
Updated
Recommended
```

Recommendation сначала rule-based.

Не вводить ML infrastructure.

---

# 33. TASK-030 — Search v2

Единый search должен поддерживать:

```text
Product
Server
Developer
Organization
Article
```

Filters:

```text
type
category
price
rating
verified
status
```

Pagination обязательна.

---

# 34. TASK-031 — Command Palette

`Ctrl/Cmd + K`

Действия:

```text
Search
Go to Market
Go to Servers
Go to Workspace
Open Profile
Create Product
Create Server
Open Notifications
```

После создания entity list palette должен понимать permissions пользователя.

---

# 35. TASK-032 — Workspace v2

Workspace должен стать центром управления.

Structure:

```text
Personal
Organization
Server
```

Динамический контент определяется context.

Не создавать три разных application shells.

---

# 36. TASK-033 — Developer Workspace

Для developer:

```text
Overview
Products
Builds
Sales
Licenses
Downloads
Articles
Organization
Analytics
Settings
```

---

# 37. TASK-034 — Server Workspace

Для server owner:

```text
Overview
Servers
Players
Licenses
Updates
Analytics
Advertising
Settings
```

---

# 38. TASK-035 — Organization Workspace

Для studio:

```text
Overview
Team
Products
Servers
Sales
Members
Activity
Settings
```

Все permissions через organization role system.

---

# 39. TASK-036 — Account Security

Добавить:

```text
Password change
Session management
Logout all sessions
Email verification
2FA foundation
```

Показывать активные sessions:

```text
device
IP
created
last used
```

---

# 40. TASK-037 — Discord Integration Foundation

Подготовить OAuth/identity abstraction для:

```text
Discord
```

Discord authentication может быть включена после проверки provider configuration.

Не делать Discord обязательным для обычного account login.

---

# 41. TASK-038 — Email System

Подготовить реальные flows:

```text
Email verification
Password reset
Security notification
```

Development:

```text
Mailpit
```

Production:

```text
SMTP/provider abstraction
```

---

# 42. TASK-039 — API Rate Limiting

Покрыть rate limits:

```text
Login
Register
Password reset
Search
Reports
Reviews
Follow
Notifications
Downloads
Admin actions
Heartbeat
```

Limits должны отличаться по типу endpoint.

---

# 43. TASK-040 — API Validation Audit

Каждый API endpoint должен иметь:

```text
Authentication
Authorization
Input validation
Output DTO
Error handling
Rate limit
Audit where required
```

---

# 44. TASK-041 — IDOR Audit

Провести отдельную security проверку:

```text
Users
Orders
Licenses
Notifications
Reports
Saved
Follow
Products
Builds
Organizations
Servers
```

Проверить:

```text
Can user A access user B?
Can member A modify organization B?
Can owner A modify server B?
Can buyer A download product B?
```

---

# 45. TASK-042 — CSRF / Cookie Audit

Проверить:

```text
httpOnly
secure
sameSite
expiration
session invalidation
```

Для state-changing APIs обеспечить корректную CSRF/XSRF strategy, совместимую с текущим cookie architecture.

---

# 46. TASK-043 — Upload Security

Проверить:

```text
path traversal
extension spoofing
MIME spoofing
oversized files
archive bombs
malicious content
duplicate files
```

Uploaded content не должен исполняться web server как application code.

---

# 47. TASK-044 — Audit Trail v2

Улучшить audit:

```text
actor
action
target
timestamp
ip
userAgent
context
metadata
requestId
```

Критические действия:

```text
login
logout
password change
permission change
verification
moderation
purchase
refund
license change
download
admin actions
```

---

# 48. TASK-045 — Observability

Добавить единый request correlation:

```text
requestId
```

Логи должны связывать:

```text
request
user
action
error
```

Без логирования паролей, session tokens и secrets.

---

# 49. TASK-046 — Database Integrity

Проверить:

```text
foreign keys
unique indexes
check constraints
transaction boundaries
cascade behaviour
nullability
```

Особенно:

```text
Orders
Payments
Ledger
Licenses
Entitlements
Reviews
Follows
Notifications
```

---

# 50. TASK-047 — Financial Integrity

Проверить:

```text
duplicate order completion
duplicate payment processing
duplicate license creation
double ledger entry
refund consistency
```

Любые critical operations должны поддерживать idempotency.

---

# 51. TASK-048 — Pagination / Query Audit

Найти любые места, где делается:

```text
Array.from(...)
```

для database-scale collections.

Заменить на:

```text
SQL
LIMIT
OFFSET/cursor
ORDER BY
```

где это необходимо.

---

# 52. TASK-049 — Performance Audit

Проверить:

```text
N+1 queries
unnecessary client components
large payloads
duplicate requests
uncached reads
image sizes
database indexes
```

---

# 53. TASK-050 — UI Refinement

После функционального hardening провести второй UI pass.

Цель:

```text
Compact
Professional
Dense
Consistent
Desktop-first
```

Особенно:

```text
Homepage
Marketplace
Product page
Server page
Profile
Workspace
Admin
```

Не создавать новый design system с нуля.

Использовать существующий `@nexus/ui`.

---

# 54. TASK-051 — Homepage v2

Главная должна одновременно показывать:

```text
Discovery
Live servers
Products
Developers
Articles
Updates
Sponsored placement
```

Система должна быть компактной.

Не giant landing page.

---

# 55. TASK-052 — Marketplace v2

Добавить более полезную product discovery:

```text
Categories
Filters
Sort
Verified creators
Ratings
Price
Compatibility
Recently updated
```

Карточки показывают главные decision signals.

---

# 56. TASK-053 — Server Directory v2

Cards:

```text
Logo
Name
Mode
Players
Status
Region
Verified
```

Не перегружать карточки.

---

# 57. TASK-054 — Public Trust Signals

На карточках:

```text
Verified developer
Verified server
Verified purchase
```

Trust signals должны использовать единый UI language.

---

# 58. TASK-055 — Mobile / Laptop Reliability

Несмотря на desktop-first подход:

```text
Laptop
Tablet
Mobile
```

не должны ломать основные flows.

Приоритет:

```text
Desktop > Laptop > Tablet > Mobile
```

---

# 59. TASK-056 — Tests

Добавить regression tests для всего Nexus 1.2:

```text
Auth
Profiles
Organizations
Marketplace
Purchases
Licenses
Downloads
Reviews
Follow
Saved
Notifications
Reports
Admin
```

---

# 60. TASK-057 — Security Tests

Обязательно:

```text
IDOR
Privilege escalation
Notification ownership
Private download
Organization isolation
Server ownership
License isolation
Review abuse
Admin authorization
```

---

# 61. TASK-058 — E2E Critical Flows

### Buyer

```text
Register
↓
Search
↓
Product
↓
Purchase
↓
License
↓
Download
↓
Review
```

### Developer

```text
Login
↓
Organization
↓
Product
↓
Build
↓
Publish
↓
Sales
```

### Server owner

```text
Login
↓
Create server
↓
Verify ownership
↓
Heartbeat
↓
Public server page
↓
Publish update
```

### Admin

```text
Report
↓
Moderation
↓
Verification
↓
Audit
```

---

# 62. TASK-059 — Release Documentation

Обновить:

```text
docs/ARCHITECTURE.md
docs/API.md
docs/AUTH.md
docs/DATA_MODEL.md
docs/SECURITY.md
docs/STORAGE.md
docs/DEVELOPMENT.md
```

Документация должна отражать фактическое состояние Nexus 1.3.

---

# 63. TASK-060 — Module Contracts

Только подготовить contracts для следующего этапа:

```text
Server Installation
Authentication
Heartbeat
License verification
Entitlement verification
Capability discovery
Asset delivery
Version compatibility
```

Не реализовывать:

```text
C++ Module
anti-dump
runtime protection
native asset decoder
memory protection
```

---

# 64. Definition of Done

Nexus 1.3 готов, когда:

### Platform

```text
Real database
Real auth
Real sessions
Real storage
Real marketplace
Real licenses
Real entitlements
Real orders
Real ledger
```

### Trust

```text
Verification
Reports
Moderation
Trust signals
Blacklist foundation
```

### Servers

```text
Ownership
Verification
Heartbeat
Real status
Updates
Analytics foundation
```

### Commerce

```text
Seller dashboard
Commission foundation
Featured placements
Advertising slots
```

### Users

```text
Profiles
Organizations
Workspace
Search
Explore
Follow
Saved
Notifications
Reviews
```

### Security

```text
IDOR audit
Rate limiting
Upload security
Cookie audit
Audit trail
Financial idempotency
```

### Quality

```bash
pnpm check
pnpm test
pnpm build
```

должны завершаться без ошибок.

---

# 65. Что НЕ входит в Nexus 1.3

Не делать:

```text
Nexus Module
C++ runtime
Anti-dump engine
Protected DFF/TXD pipeline
Full escrow
Freelance marketplace
API marketplace
Hosting marketplace
Creator marketplace
Microservices
Redis
Elasticsearch
ML recommendation system
```

---

# 66. Nexus 1.3 End State

```text
                         MTA NEXUS
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
    Identity              Discovery               Commerce
       │                      │                      │
 Users / Sessions       Search / Explore       Products
 Profiles               Feed / Follow          Orders
 Organizations          Saved                  Payments
 Permissions            Trending               Ledger
       │                      │                      │
       ├──────────────────────┼──────────────────────┤
       │                      │                      │
      Trust                Servers              Content
       │                      │                      │
 Verification            Ownership             Articles
 Reports                 Heartbeat              Updates
 Moderation              Status                 Devlogs
 Reputation              Analytics              Reviews
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              │
                         Nexus Core
                              │
                  ┌───────────┼───────────┐
                  │           │           │
               PostgreSQL   Storage     Events
```

---

# 67. Главный результат

Nexus 1.3 должен закрыть следующий цикл:

```text
USER
 ↓
DISCOVER
 ↓
TRUST
 ↓
BUY
 ↓
LICENSE
 ↓
USE
 ↓
FOLLOW
 ↓
RETURN
```

И для создателя:

```text
CREATE
 ↓
PUBLISH
 ↓
SELL
 ↓
UPDATE
 ↓
EARN
 ↓
BUILD REPUTATION
```

А для сервера:

```text
REGISTER
 ↓
VERIFY
 ↓
GO ONLINE
 ↓
GROW
 ↓
PUBLISH UPDATES
 ↓
CONNECT WITH ECOSYSTEM
```

После этого Nexus 1.3 становится стабильной платформой, на которую можно без архитектурного долга ставить следующий слой — Nexus Module.