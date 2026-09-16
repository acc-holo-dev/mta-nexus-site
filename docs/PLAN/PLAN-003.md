# PLAN-003 — MTA Nexus 1.2
## Nexus Public Platform: первая полноценная пользовательская версия

**Статус:** Planned  
**Версия:** Nexus 1.2  
**Предыдущая версия:** Nexus 1.1  
**Repository:** `acc-holo-dev/mta-nexus-site`  
**Branch:** `main`

---

# 1. Цель

После Nexus 1.1 платформа должна иметь настоящий backend core.

Nexus 1.2 должен превратить этот Core в полноценный пользовательский продукт.

Главная задача:

> **Сделать Nexus удобным, понятным и реально полезным для первого пользователя: игрока, разработчика и владельца сервера.**

Nexus 1.2 не должен превращаться в строительство всех будущих функций.

Основной результат:

```text
Nexus 1.1
Real Core
    ↓
Nexus 1.2
Usable Public Platform
    ↓
Discovery
Profiles
Servers
Marketplace
Workspace
Purchases
Licenses
Notifications
Search
Polished UI
```

---

# 2. Что уже должно считаться готовым

PLAN-003 начинается только поверх Nexus 1.1.

Предполагается:

- PostgreSQL runtime;
- реальная authentication;
- реальные sessions;
- authorization;
- products;
- builds;
- storage;
- licenses;
- entitlements;
- orders;
- ledger;
- admin;
- audit;
- integration tests;
- базовая security модель.

Если какая-либо из этих частей ещё mock-based, сначала завершить соответствующую задачу PLAN-002.

---

# 3. Основная продуктовая модель Nexus 1.2

Nexus должен начать восприниматься не как набор технических страниц, а как единая экосистема.

Основные публичные сущности:

```text
User
Developer
Organization
Server
Product
Article
```

Основные пользовательские действия:

```text
Discover
Search
View
Follow
Buy
Download
Manage
Publish
```

---

# 4. TASK-001 — Новый Nexus Shell

Создать единый основной application shell.

Структура:

```text
┌─────────────────────────────────────────────┐
│ Nexus Logo   Search        Notifications   │
├─────────────┬───────────────────────────────┤
│             │                               │
│ Navigation  │          Main Content         │
│             │                               │
│             │                               │
│             │                               │
└─────────────┴───────────────────────────────┘
```

Поддержать:

- collapsible sidebar;
- global search;
- notifications;
- user context;
- theme switch;
- navigation;
- breadcrumbs;
- responsive desktop layout.

Не делать дублирование navigation между sidebar и topbar.

---

# 5. TASK-002 — Context-aware navigation

Navigation должна зависеть от текущего пользователя и контекста.

Минимальные contexts:

```text
Personal
Organization
Server
```

Пример:

```text
Personal
├── Overview
├── Purchases
├── Licenses
├── Saved
└── Settings

Organization
├── Overview
├── Products
├── Sales
├── Team
└── Settings

Server
├── Overview
├── Licenses
├── Updates
├── Analytics
└── Settings
```

Не показывать пользователю функции, которыми он не может пользоваться.

---

# 6. TASK-003 — Dashboard

Создать персональный `/workspace`.

Dashboard должен отображать реальные данные.

Для обычного пользователя:

```text
Recent purchases
Active licenses
Saved products
Followed servers
Recent notifications
```

Для developer:

```text
Products
Sales
Downloads
Active licenses
Recent activity
```

Для server owner:

```text
Servers
Online players
Licenses
Recent updates
Server activity
```

Не создавать три отдельных dashboard systems.

Использовать общий composable dashboard framework.

---

# 7. TASK-004 — Profile

Создать полноценный public profile.

Минимум:

```text
Avatar
Username
Display name
Bio
Verification
Joined date
Developer status
Organizations
Products
Servers
Articles
```

Public URL:

```text
/users/:username
```

Для developer:

```text
/developers/:username
```

При этом не дублировать абсолютно одинаковые страницы.

---

# 8. TASK-005 — Developer profile

Developer profile должен отображать:

```text
Developer identity
Specializations
Organization
Products
Sales
Reviews
Articles
Activity
Links
```

Показатели:

```text
Products published
Total sales
Rating
Completed work
```

Статистику нельзя брать из hardcoded mock values.

---

# 9. TASK-006 — Organization / Studio

Создать реальный organization profile.

URL:

```text
/organizations/:slug
```

Показывать:

- logo;
- description;
- website;
- team;
- products;
- servers;
- articles;
- verification;
- public activity.

Внутри organization:

```text
Owner
Admin
Developer
Member
```

Работа через уже существующий permission system.

---

# 10. TASK-007 — Server public page

Полностью привести server pages к реальному продукту.

URL:

```text
/servers/:slug
```

Показывать:

```text
Server name
Banner
Logo
Status
Players online
Max players
Game mode
Map
Description
Owner
Organization
Verification
Reviews
Articles / updates
```

Не показывать автоматически список используемых сервером продуктов.

Если владелец хочет что-либо показать — он сам публикует эту информацию.

---

# 11. TASK-008 — Server discovery

Страница:

```text
/servers
```

Функции:

```text
Search
Online count
Game mode
Region
Verified
Popularity
Recently updated
```

Карточка сервера должна позволять быстро понять:

```text
What is it?
Is it online?
How many players?
What type of server?
```

---

# 12. TASK-009 — Marketplace redesign

Страница:

```text
/market
```

должна стать центральной точкой коммерческой части Nexus.

Структура:

```text
Search
Filters
Categories
Sorting
Products
```

Категории:

```text
Scripts
Vehicles
Maps
UI
Models
Plugins
Bundles
Services
```

Не создавать отдельные backend systems для каждой категории.

Все остаются `Product`.

---

# 13. TASK-010 — Product page

Создать полноценную product page.

URL:

```text
/market/:slug
```

Содержимое:

```text
Hero
Preview
Description
Features
Compatibility
Versions
License
Price
Developer
Organization
Reviews
Changelog
```

Основная CTA:

```text
Buy
```

или для уже купленного:

```text
Open license
Download
View versions
```

UI должен понимать entitlement пользователя.

---

# 14. TASK-011 — Product ownership UX

Пользователь должен сразу видеть:

```text
Owned
Licensed
Available
Expired
```

Например:

```text
Product
      ↓
User has license
      ↓
Show license state
```

Не предлагать повторно купить продукт, если текущий entitlement уже предоставляет доступ, кроме случаев, предусмотренных license model.

---

# 15. TASK-012 — Purchases

Создать:

```text
/workspace/purchases
```

Пользователь видит:

```text
Order
Product
Price
Date
Status
License
```

Доступ только к своим покупкам.

---

# 16. TASK-013 — Licenses

Создать:

```text
/workspace/licenses
```

Карточка license:

```text
Product
License ID
Status
Server
Expiration
Entitlements
Available builds
```

Для server-bound license:

```text
Server: SA Drift Paradise
```

---

# 17. TASK-014 — Downloads

Создать понятный download flow.

```text
License
   ↓
Entitlement check
   ↓
Available build
   ↓
Authorized download
```

Не делать:

```text
/static/product.zip
```

Все downloads проходят authorization.

---

# 18. TASK-015 — Build history

На product page:

```text
Versions
├── 3.2.0
├── 3.1.0
├── 3.0.0
└── ...
```

Для каждой версии:

```text
Version
Release date
Release notes
Compatibility
File size
Status
```

Licensed user может получить разрешённые версии.

---

# 19. TASK-016 — Global search

Создать единый поиск Nexus.

Search должен искать:

```text
Products
Servers
Developers
Organizations
Articles
```

UI:

```text
Ctrl + K
```

Search result должен иметь тип:

```text
Product
Server
Developer
Organization
Article
```

Не создавать отдельный frontend search для каждого раздела.

---

# 20. TASK-017 — Search UX

Добавить:

```text
Recent searches
Suggested results
Categories
Keyboard navigation
Enter to search
```

При поиске:

```text
"drift"
```

показывать:

```text
Products
Servers
Developers
Articles
```

а не только marketplace results.

---

# 21. TASK-018 — Explore

Создать `/explore`.

Explore должен быть discovery layer Nexus.

В нём:

```text
Trending products
Trending servers
New developers
Latest articles
Recently updated
Popular categories
```

Explore не должен становиться отдельной базой данных.

Он использует существующие сущности.

---

# 22. TASK-019 — Home

Главная страница должна быть переработана вокруг реального экосистемного контента.

Приоритет:

```text
Discovery
Marketplace
Servers
Developers
Articles
```

Убрать чрезмерно большой marketing hero.

Вместо этого использовать компактный Nexus canvas:

```text
┌─────────────────────────────────────────┐
│ Search / Discovery                      │
├───────────────┬─────────────────────────┤
│ Featured      │ Live Servers            │
│ Products      │                         │
├───────────────┴─────────────────────────┤
│ Latest / Trending / Recommended         │
├─────────────────────────────────────────┤
│ Developers / Articles / Updates         │
└─────────────────────────────────────────┘
```

---

# 23. TASK-020 — Feed foundation

Использовать существующую event architecture.

Feed должен собираться из событий:

```text
Product published
Build released
Server updated
Article published
Developer joined
Product updated
```

Не создавать отдельную complicated social platform.

---

# 24. TASK-021 — Follow

Пользователь может follow:

```text
Developer
Organization
Server
Product
```

Использовать существующую `follows` model.

После follow события становятся потенциальными источниками feed/notification.

---

# 25. TASK-022 — Saved

Создать:

```text
/workspace/saved
```

Пользователь может сохранять:

```text
Products
Servers
Articles
Developers
```

Сделать единую модель saved targets, а не отдельную таблицу для каждого типа.

---

# 26. TASK-023 — Notifications

Создать полноценный notification center.

Минимальные события:

```text
Purchase completed
License created
License changed
Product update
Build release
Followed developer update
Server update
System notification
```

UI:

```text
Unread
Read
All
```

Добавить:

```text
Mark as read
Mark all as read
```

---

# 27. TASK-024 — Activity

Добавить activity feed в user/developer/organization/server contexts.

Примеры:

```text
Published new product
Released build 2.1.0
Published article
Server went online
Server updated
```

Никаких ручных fake activities.

Все активности должны быть derived from real events.

---

# 28. TASK-025 — Reviews

На данном этапе реализовать review foundation для marketplace.

Review должен содержать:

```text
Author
Product
Rating
Text
Verified purchase
CreatedAt
```

Требование:

```text
Verified purchase = actual completed order
```

Нельзя выставить verified review без соответствующей покупки.

---

# 29. TASK-026 — Product rating

Перестать хранить рейтинг как простой hardcoded statistic.

Рейтинг должен рассчитываться из reviews.

Допустимо использовать cached aggregate:

```text
ratingAverage
ratingCount
```

но source of truth:

```text
reviews
```

---

# 30. TASK-027 — Articles

Привести articles к общей Content system.

Поддержать:

```text
Article
Guide
Devlog
Announcement
Server update
```

Не создавать отдельные CMS systems.

---

# 31. TASK-028 — Article discovery

На `/articles`:

```text
Latest
Trending
Developers
Servers
Topics
```

Статья может быть связана с:

```text
Developer
Organization
Product
Server
```

---

# 32. TASK-029 — Monetization foundation

Nexus 1.2 должен подготовить первую реальную точку монетизации.

Не добавлять десять тарифов.

Подготовить:

```text
Product sale commission
```

и:

```text
Featured placement
```

Featured placement должен быть админ-контролируемым и явно обозначаться как sponsored/promoted content.

Органическая выдача не должна незаметно превращаться в платную рекламу.

---

# 33. TASK-030 — Featured content

Создать систему:

```text
featured
```

для:

```text
Product
Server
Developer
Article
```

Минимально:

```text
target
startAt
endAt
placement
status
```

На данном этапе не требуется сложная advertising exchange.

---

# 34. TASK-031 — Admin moderation UX

Публичная система должна иметь базовую trust layer.

Admin должен управлять:

```text
Products
Users
Servers
Articles
Reports
Reviews
Featured placements
```

Actions:

```text
Approve
Reject
Suspend
Restore
Feature
Unfeature
```

Все actions:

```text
Authorization
↓
Action
↓
Audit event
```

---

# 35. TASK-032 — Reports

Добавить пользовательский report flow.

Репортировать:

```text
Product
Server
User
Article
Review
```

Причины:

```text
Copyright
Scam
Abuse
Spam
Malicious content
Other
```

Report создаёт moderation case.

---

# 36. TASK-033 — UX security

Убедиться, что UI никогда не выдаёт ложное ощущение permissions.

Например:

если пользователь видит:

```text
Edit Product
```

то backend всё равно обязан проверить authorization.

UI hiding является UX feature, а не security control.

---

# 37. TASK-034 — SEO

Публичные страницы должны иметь:

```text
title
description
canonical
OpenGraph
Twitter/X metadata
```

Минимум:

```text
Products
Servers
Developers
Organizations
Articles
```

Не делать сложный SEO infrastructure.

---

# 38. TASK-035 — Public URL strategy

Использовать стабильные публичные routes:

```text
/market/:slug
/servers/:slug
/developers/:username
/organizations/:slug
/articles/:slug
```

Slug должен быть безопасным и уникальным.

Не использовать database UUID как публичный URL там, где нужен человекочитаемый адрес.

---

# 39. TASK-036 — UI design system

Укрепить существующий `@nexus/ui`.

Минимальный набор:

```text
Button
Input
Select
Dialog
Dropdown
Tabs
Badge
Card
Table
Toast
Tooltip
Avatar
Skeleton
EmptyState
Pagination
```

Компоненты должны быть reusable.

Не копировать одинаковые Tailwind blocks между страницами.

---

# 40. TASK-037 — Visual direction

Основной стиль Nexus:

```text
Professional
Compact
Dense
Desktop-first
Technical
Modern
```

Главные правила:

- меньше пустого пространства;
- меньше giant hero blocks;
- больше информации на экране;
- чёткая hierarchy;
- единая iconography;
- единые spacing tokens;
- light и dark themes;
- нормальная keyboard navigation.

---

# 41. TASK-038 — Responsive behavior

Основной target:

```text
Desktop
```

Но интерфейс не должен ломаться на:

```text
Laptop
Tablet
Mobile
```

Не растягивать desktop layouts на огромные пространства.

Использовать max-width containers.

---

# 42. TASK-039 — Loading / error / empty states

Все публичные и workspace страницы должны поддерживать:

```text
Loading
Empty
Error
Success
```

Например:

```text
No purchases yet.
No licenses yet.
No followed servers.
No products found.
```

---

# 43. TASK-040 — Performance

Проверить:

- server components там, где они полезны;
- минимальный client JS;
- image optimization;
- caching;
- pagination;
- database query limits;
- отсутствие N+1 queries.

Не загружать весь marketplace в memory.

---

# 44. TASK-041 — Pagination

Обязательная пагинация для коллекций:

```text
Products
Servers
Articles
Orders
Licenses
Notifications
Reports
Admin tables
```

Не использовать:

```ts
Array.from(...)
```

для больших коллекций в production paths.

---

# 45. TASK-042 — Authorization audit

Для каждой страницы и API endpoint проверить:

```text
Who can read?
Who can create?
Who can modify?
Who can delete?
Who can publish?
Who can see private data?
```

Особенно:

```text
/workspace/*
/admin/*
/market/*
/servers/*
/organizations/*
```

---

# 46. TASK-043 — Data privacy

Не отдавать публично:

```text
email
session data
private storage keys
internal IDs where unnecessary
security metadata
private audit information
```

Public API должен использовать DTO/view models.

Не передавать database models напрямую в client.

---

# 47. TASK-044 — API contracts

Определить стабильные API contracts для:

```text
auth
products
servers
profiles
licenses
orders
notifications
search
reports
admin
```

Validation должна оставаться через Zod schemas.

---

# 48. TASK-045 — Integration tests

Добавить integration coverage на новые flows:

```text
User
→ Follow
→ Feed event

User
→ Purchase
→ License

User
→ Product
→ Review

Developer
→ Product
→ Build

Server owner
→ Server
→ Update

Admin
→ Report
→ Moderation
```

---

# 49. TASK-046 — E2E user journeys

Обязательные E2E:

### Player

```text
Register
↓
Login
↓
Search server
↓
Open server
↓
Follow server
↓
See notification/feed
```

### Buyer

```text
Login
↓
Search product
↓
Open product
↓
Purchase
↓
License created
↓
Open license
↓
Download build
```

### Developer

```text
Login
↓
Create organization
↓
Create product
↓
Publish
↓
Release build
↓
View product
↓
View sales
```

### Admin

```text
Login
↓
Admin
↓
Review report
↓
Moderate
↓
Audit event
```

---

# 50. TASK-047 — Demo data separation

Demo seed остаётся только инструментом development.

Нельзя:

```text
hardcode user
hardcode product
hardcode server statistics
hardcode orders
hardcode license
```

Production UI должен получать реальные records.

---

# 51. TASK-048 — Remove prototype artifacts

Полностью удалить из production UI:

```text
"Demo"
"Prototype"
"Mock"
"System Healthy"
"Cryptographically Recorded"
```

если соответствующая функция реально не реализована.

UI должен описывать реальные возможности.

---

# 52. TASK-049 — Documentation

Обновить:

```text
docs/ARCHITECTURE.md
docs/API.md
docs/AUTH.md
docs/DATA_MODEL.md
docs/SECURITY.md
docs/DEVELOPMENT.md
```

Добавить документацию по:

```text
Workspace
Contexts
Profiles
Marketplace
Search
Feed
Notifications
Reviews
Reports
Featured placements
```

---

# 53. TASK-050 — Release preparation

Подготовить Nexus 1.2 как первую публично тестируемую версию.

Перед release:

```bash
pnpm check
pnpm test
pnpm build
```

Все должны завершаться успешно.

Проверить:

```text
clean install
database migration
database seed
dev startup
production build
production startup
```

---

# 54. Definition of Done

Nexus 1.2 считается завершённым, когда пользователь может:

```text
Register
Login
Create profile
Search ecosystem
Discover products
Discover servers
View developers
View organizations
Read articles
Follow entities
Save entities
Receive notifications
Purchase product
Receive license
Download authorized build
Leave verified review
Manage workspace
```

Developer может:

```text
Create product
Release builds
Manage product
View sales
Maintain profile
Manage organization
```

Server owner может:

```text
Create server
Manage server
View licenses
Publish updates
Manage public server profile
```

Admin может:

```text
Moderate
Manage featured placements
Review reports
Inspect audit
Manage platform entities
```

---

# 55. Что НЕ входит в Nexus 1.2

Не реализовывать:

```text
Escrow
Freelance marketplace
API marketplace
Hosting marketplace
Creator marketplace
Nexus Module runtime
Advanced anti-dump
Hardware attestation
Distributed storage
Microservices
Redis
Elasticsearch
Advanced recommendation ML
Enterprise billing
Complex advertising marketplace
```

Это будущие extension layers.

---

# 56. Nexus 1.2 Architecture

После PLAN-003:

```text
                         MTA NEXUS
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          Identity        Discovery         Commerce
             │                │                │
       Users / Org       Search / Feed     Products
       Contexts          Explore           Orders
       Sessions          Follow            Licenses
                          Saved             Entitlements
             │                │                │
             └────────────────┼────────────────┘
                              │
                        Nexus Core 1.1
                              │
                ┌─────────────┼─────────────┐
                │             │             │
             PostgreSQL     Storage       Events
```

---

# 57. Главный результат

Nexus 1.2 не должен просто содержать больше кода.

Он должен дать первый законченный пользовательский цикл:

```text
DISCOVER
   ↓
SEARCH
   ↓
VIEW
   ↓
TRUST
   ↓
BUY
   ↓
LICENSE
   ↓
DOWNLOAD
   ↓
FOLLOW
   ↓
RETURN
```

И параллельно второй:

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
```

Это становится первой версией Nexus, которую уже можно показывать реальным MTA-разработчикам и владельцам серверов без ощущения внутреннего prototype.

**Target:** `Nexus 1.2 Public Platform`

**Основной принцип:** не расширять Nexus во все стороны, а довести уже созданные Core-механизмы до цельного пользовательского продукта.