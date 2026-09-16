# PLAN-005 — MTA Nexus 1.4
## Product Experience, Design System & Production UI

**Статус:** Planned  
**Версия:** Nexus 1.4  
**Предыдущая версия:** Nexus 1.3  
**Repository:** `acc-holo-dev/mta-nexus-site`  
**Branch:** `main`

---

# 1. Цель

Nexus 1.3 уже получил основу production-платформы:

```text
Authentication
Database
Marketplace
Products
Purchases
Licenses
Profiles
Organizations
Servers
Trust
Verification
Reports
Notifications
Follow
Server telemetry
Admin
Storage
Commerce
```

Следующий этап не должен превращаться в бесконечное добавление новых сущностей.

Главная цель Nexus 1.4:

> **Сделать MTA Nexus визуально цельным, быстрым, понятным и похожим на законченный коммерческий продукт.**

Переход:

```text
Nexus 1.3
Functional Platform
        ↓
Nexus 1.4
Product Experience
        +
Design System
        +
Navigation
        +
Discovery
        +
Workspace UX
        +
Production Polish
```

---

# 2. Главный принцип

Не переписывать архитектуру.

Сохраняем:

```text
Next.js
React
TypeScript
Modular Monolith
PostgreSQL
Drizzle
Storage abstraction
Domain services
Existing API
Existing authentication
Existing commerce
```

PLAN-005 прежде всего работает поверх уже существующей платформы.

Не вводить:

```text
Microservices
Redis
Elasticsearch
Kafka
ML
новые платные API
```

если существующей архитектуры достаточно.

---

# 3. TASK-001 — Полный UX audit

Провести обход всего текущего интерфейса:

```text
Home
Explore
Marketplace
Product
Servers
Server
Users
Organizations
Articles
Notifications
Purchases
Licenses
Saved
Workspace
Admin
Auth
Search
```

Для каждого экрана определить:

```text
Good
Weak
Duplicated
Confusing
Too empty
Too large
Too dense
Missing state
Broken state
```

Не писать новые страницы до окончания audit.

---

# 4. TASK-002 — Создать единый Nexus Design System

Определить единый визуальный язык.

Параметры:

```text
Typography
Font sizes
Font weights
Spacing
Radius
Borders
Shadows
Surfaces
Icons
Buttons
Inputs
Badges
Tabs
Cards
Tables
Dropdowns
Modals
Toasts
Skeletons
Empty states
```

Компоненты должны использовать общие primitives.

Не допускать:

```text
каждая страница выглядит по-своему
```

---

# 5. TASK-003 — Typography System

Выбрать и зафиксировать основной интерфейсный шрифт.

Определить:

```text
Display
Heading
Body
Label
Caption
Numeric
Code
```

Особенно привести к единому виду:

```text
Product prices
Player counts
Statistics
Balances
Dates
Status labels
```

Цель:

> Интерфейс должен выглядеть как единый продукт, а не набор независимых страниц.

---

# 6. TASK-004 — Nexus Layout Shell

Пересобрать основной shell.

Целевая структура:

```text
┌───────────────────────────────────────────────┐
│ Sidebar │ Topbar                             │
│         ├─────────────────────────────────────┤
│         │                                     │
│         │ Main Content                        │
│         │                                     │
│         │                                     │
└─────────┴─────────────────────────────────────┘
```

Sidebar:

```text
Home
Explore
Marketplace
Servers
Community
Workspace
```

Никаких дублирующих элементов.

---

# 7. TASK-005 — Sidebar UX

Sidebar:

```text
Compact
Collapsible
Desktop-first
Keyboard friendly
Persistent state
```

Состояния:

```text
Expanded
Collapsed
```

Не создавать отдельный scrollbar внутри меню без необходимости.

Активный пункт должен быть очевиден.

---

# 8. TASK-006 — Topbar

Topbar не должен быть пустым.

Основные элементы:

```text
Global Search
Quick actions
Notifications
Balance
Profile
```

Убрать повторяющиеся элементы из sidebar/topbar.

Не использовать несколько разных кнопок для одной функции.

---

# 9. TASK-007 — Global Search UX

Search становится одним из главных элементов Nexus.

Поддержать:

```text
Products
Servers
Users
Organizations
Articles
```

Показывать:

```text
Recent
Suggested
Categories
Results
```

Добавить:

```text
Ctrl/Cmd + K
```

Search должен ощущаться частью всей платформы, а не отдельной страницей.

---

# 10. TASK-008 — Command Palette

Создать единый command palette:

```text
Search
Navigate
Create
Workspace
Account
Notifications
```

Примеры:

```text
Go to Marketplace
Go to Servers
Create Product
Create Server
Open Workspace
Open Purchases
Open Notifications
```

Показывать действия только при наличии соответствующих permissions.

---

# 11. TASK-009 — Homepage redesign

Homepage должна перестать быть обычным маркетинговым landing page.

Nexus — это ecosystem.

Главная должна сразу показывать:

```text
Featured / Advertising
Marketplace
Servers
Community
Articles
Creators
```

Целевая композиция:

```text
Topbar

Featured Nexus panel

Marketplace
[resource] [resource] [resource] [resource]

Servers
[server] [server] [server]

Community / Articles
[article] [discussion] [news]

More discovery
```

Не делать гигантский hero с пустым пространством.

---

# 12. TASK-010 — Homepage Advertising System UI

Использовать существующую advertising/featured foundation.

В интерфейсе выделить:

```text
Featured
Sponsored
Organic
```

Sponsored placement должен визуально отличаться от обычной выдачи.

Но не должен ломать layout.

---

# 13. TASK-011 — Marketplace redesign

Marketplace должен стать основной commerce-зоной.

Новая структура:

```text
Marketplace

Categories
Filters
Search
Sort

Featured
Popular
New
Updated

Product Grid
```

Product card должна показывать:

```text
Cover
Title
Creator
Rating
Verified
Price
Sales / useful metric
Updated
```

Без визуального мусора.

---

# 14. TASK-012 — Product page redesign

Product page:

```text
Gallery
Title
Creator
Trust signals
Price
Buy
Save
Follow
```

Ниже:

```text
Description
Features
Compatibility
Versions
Changelog
Reviews
Developer
Related products
```

Главная информация должна быть видна без необходимости долго скроллить.

---

# 15. TASK-013 — Server directory redesign

Servers становятся отдельным ecosystem layer.

Карточка сервера:

```text
Banner
Logo
Name
Status
Players
Game mode
Region
Verification
Rating
```

Никогда автоматически не показывать приватный список ресурсов сервера.

То, что публикуется о сервере, определяет его владелец.

---

# 16. TASK-014 — Server page redesign

Страница сервера:

```text
Overview
Players
News
Updates
Reviews
Community
```

Основной акцент:

```text
Online status
Players
Server identity
Trust
Updates
```

---

# 17. TASK-015 — Profile redesign

Public profile:

```text
Avatar
Name
Verification
Bio
Products
Sales
Reviews
Servers
Organizations
Activity
```

Разделять:

```text
Public information
Private information
```

Пользователь не должен случайно раскрывать внутренние данные workspace.

---

# 18. TASK-016 — Organization / Developer page redesign

Сделать developer identity полноценной частью платформы.

Показывать:

```text
Studio / Developer
Verification
Products
Servers
Team
Activity
Stats
```

Убрать ощущение "обычного профиля пользователя".

---

# 19. TASK-017 — Workspace redesign

Workspace должен стать рабочим инструментом, а не просто набором страниц.

Общий shell:

```text
Workspace
├── Overview
├── Products
├── Sales
├── Licenses
├── Analytics
├── Content
├── Team
└── Settings
```

Для server / organization / developer использовать один UX framework.

---

# 20. TASK-018 — Dashboard cards

Создать единый формат dashboard cards:

```text
Metric
Value
Change
Context
Action
```

Примеры:

```text
Sales
Revenue
Players
Downloads
Licenses
Followers
```

Не использовать огромное количество графиков.

---

# 21. TASK-019 — Tables UX

Для:

```text
Orders
Sales
Licenses
Products
Builds
Reports
Users
```

создать единый table system.

Поддержать:

```text
Pagination
Sorting
Filtering
Search
Row actions
Empty state
Loading state
Error state
```

---

# 22. TASK-020 — Loading / Empty / Error states

Каждый экран должен иметь:

```text
Loading
Empty
Error
Success
Unauthorized
Not found
```

Никаких пустых белых/темных экранов.

---

# 23. TASK-021 — Notifications UX

Notifications center:

```text
Unread
All
System
Commerce
Social
Security
```

Каждое уведомление должно иметь:

```text
Icon
Title
Description
Timestamp
Action
Read state
```

---

# 24. TASK-022 — Trust UI

Unified trust language:

```text
Verified
Verified Purchase
Verified Developer
Verified Server
Official
Sponsored
```

Badge system должен использовать одинаковые правила во всей платформе.

---

# 25. TASK-023 — Commerce UX

Привести к единому виду:

```text
Price
Balance
Purchase
Order
License
Revenue
Seller earnings
```

Особенно важно различать:

```text
Product price
Platform fee
Seller amount
```

---

# 26. TASK-024 — Forms

Создать единый form system.

Использовать:

```text
Label
Description
Input
Validation
Error
Help
Success
```

Формы:

```text
Login
Register
Product creation
Server creation
Organization creation
Reviews
Reports
Settings
```

---

# 27. TASK-025 — Responsive desktop-first

Основная цель:

```text
Desktop
Laptop
Small laptop
```

Не проектировать интерфейс как mobile-first.

Но при этом проверить:

```text
1280px
1440px
1600px
1920px
```

Главная проблема:

```text
не растягивать UI на весь экран бессмысленным whitespace
```

---

# 28. TASK-026 — Light Theme

Light theme становится первым эталоном дизайна.

Определить:

```text
Page background
Surface
Surface elevated
Border
Primary text
Secondary text
Muted text
Accent
Success
Warning
Danger
```

Все страницы должны использовать одну систему.

---

# 29. TASK-027 — Dark Theme

После завершения light theme реализовать аналогичную dark theme.

Не делать отдельный визуальный продукт.

Обе темы должны использовать один design token system.

---

# 30. TASK-028 — Iconography

Зафиксировать единый icon language.

Не смешивать:

```text
разные стили
разную толщину
разные размеры
```

Каждая иконка должна иметь понятную semantic role.

---

# 31. TASK-029 — Motion

Добавить только необходимые micro-interactions:

```text
Navigation transition
Dropdown
Modal
Toast
Hover
Loading
Search
```

Не использовать постоянные animation effects.

---

# 32. TASK-030 — Content density

Провести отдельный density pass.

Уменьшить:

```text
лишние margins
гигантские headings
лишние paddings
пустые containers
```

Увеличить:

```text
useful information
context
quick actions
```

Главный принцип:

> На одном экране пользователь должен видеть больше полезной информации, не ощущая перегруженности.

---

# 33. TASK-031 — Navigation consistency

Проверить:

```text
Back
Breadcrumbs
Tabs
Links
Buttons
Actions
Context menus
```

Одна и та же функция должна вести себя одинаково во всей системе.

---

# 34. TASK-032 — Mobile fallback

Не делать полноценный mobile redesign.

Только обеспечить:

```text
No horizontal overflow
No broken forms
No clipped content
Readable tables
Usable dialogs
```

Desktop остаётся главным интерфейсом.

---

# 35. TASK-033 — Performance UI audit

Проверить:

```text
Images
Fonts
Client components
Server components
Data fetching
Large lists
Tables
Animations
```

Не оптимизировать преждевременно.

Устранять реальные bottlenecks.

---

# 36. TASK-034 — Accessibility pass

Проверить:

```text
Keyboard navigation
Focus states
ARIA
Labels
Contrast
Buttons
Forms
Dialogs
```

Особое внимание:

```text
Search
Sidebar
Dropdowns
Modals
Tables
```

---

# 37. TASK-035 — Security-sensitive UI audit

Пользовательский интерфейс не должен показывать:

```text
Internal IDs
Storage keys
Private moderation data
Private server resources
Internal audit information
```

Проверить public/private boundaries на всех страницах.

---

# 38. TASK-036 — Demo / placeholder cleanup

Удалить из production UI:

```text
Fake statistics
Fake users
Fake sales
Placeholder text
Demo banners
Hardcoded profile data
```

Development seed должен оставаться отдельно.

---

# 39. TASK-037 — Seed data for visual development

Создать нормальный development dataset:

```text
Users
Developers
Organizations
Products
Servers
Articles
Reviews
Notifications
Orders
Licenses
```

Он используется только для development.

Production не зависит от него.

---

# 40. TASK-038 — Component consolidation

Провести поиск дубликатов:

```text
Cards
Buttons
Inputs
Badges
Tables
Modals
Tabs
Navigation
Headers
```

Каждый повторяющийся UI primitive должен иметь одну основную реализацию.

---

# 41. TASK-039 — Route consistency

Проверить:

```text
/public
/workspace
/admin
/api
```

Названия маршрутов должны быть последовательными.

Navigation URLs не должны зависеть от внутренних implementation details.

---

# 42. TASK-040 — SEO / metadata

Привести metadata к product-level стандарту.

Для public pages:

```text
Title
Description
OpenGraph
Canonical
```

Особенно:

```text
Products
Servers
Profiles
Organizations
Articles
```

---

# 43. TASK-041 — Error handling UX

Ошибки должны быть понятны человеку.

Вместо:

```text
500
Internal Error
```

использовать:

```text
Что произошло
Что можно сделать
Action
```

Но не раскрывать internal stack traces.

---

# 44. TASK-042 — Admin UI refinement

Admin должен визуально соответствовать основному Nexus.

Основные зоны:

```text
Moderation
Verification
Reports
Users
Products
Servers
Audit
System health
```

Не создавать отдельный "второй дизайн".

---

# 45. TASK-043 — Production walkthrough

Пройти продукт как обычный пользователь:

```text
Register
Login
Explore
Search
Open product
Buy
Open purchase
Open license
Follow
Review
Open server
Read update
Open profile
```

И как creator:

```text
Create product
Publish
Create build
View sales
View license
Update product
```

И как server owner:

```text
Create server
Verify
Heartbeat
Update
Analytics
```

---

# 46. TASK-044 — Visual regression baseline

Добавить проверку ключевых экранов:

```text
Home
Marketplace
Product
Servers
Server
Profile
Workspace
Admin
```

Цель:

```text
обнаруживать случайные визуальные регрессии
```

Не создавать огромную screenshot infrastructure.

---

# 47. TASK-045 — Final UI cleanup

Последний проход по:

```text
Spacing
Typography
Borders
Colors
Icons
States
Alignment
Density
Responsive behavior
```

Убрать всё, что выглядит как prototype.

---

# 48. TASK-046 — Critical tests

Обязательно проверить:

```text
Auth
Search
Marketplace
Purchase
License
Download
Follow
Review
Server
Notifications
Workspace
Admin
```

Особенно:

```text
Unauthorized
Forbidden
Not found
Duplicate action
Expired state
Empty state
```

---

# 49. TASK-047 — Build / typecheck / lint

Финальное состояние должно проходить:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

---

# 50. TASK-048 — Documentation

Обновить:

```text
docs/ARCHITECTURE.md
docs/API.md
docs/DEVELOPMENT.md
docs/SECURITY.md
docs/STACK.md
```

Добавить:

```text
Design system
UI architecture
Workspace architecture
Navigation architecture
Public/private UI boundaries
```

---

# 51. TASK-049 — Nexus 1.4 release state

После завершения:

```text
Nexus 1.4
```

должен считаться:

```text
Functional
Secure baseline
Visually consistent
Production-oriented
Desktop optimized
```

---

# 52. TASK-050 — Prepare Nexus Module contracts

Только подготовить существующие backend contracts:

```text
ServerInstallation
Authentication handshake
Heartbeat
License verification
Entitlement verification
Capability discovery
Asset delivery
Version compatibility
```

Не реализовывать:

```text
C++
Native Module
Anti-dump engine
Protected DFF/TXD
Runtime encryption
```

в PLAN-005.

---

# 53. Definition of Done

Nexus 1.4 готов, когда:

```text
✓ единый Design System
✓ единый Shell
✓ единый Sidebar
✓ нормальный Topbar
✓ Global Search
✓ Command Palette
✓ переработанная Homepage
✓ переработанный Marketplace
✓ переработанные Product pages
✓ переработанный Server UI
✓ переработанные Profiles
✓ переработанный Workspace
✓ Light Theme
✓ Dark Theme
✓ единая Typography
✓ единая Iconography
✓ Loading states
✓ Empty states
✓ Error states
✓ Responsive desktop-first
✓ Accessibility baseline
✓ Production UI cleanup
✓ UI regression baseline
✓ tests
✓ build
✓ documentation
```

---

# 54. Что НЕ делаем в Nexus 1.4

Не добавлять:

```text
Nexus Module implementation
C++ runtime
Anti-dump engine
Escrow
Freelance marketplace
Hosting marketplace
API marketplace
ML recommendations
Microservices
Redis
Elasticsearch
Kafka
```

Также не создавать новые сложные backend-системы только ради того, чтобы "проект развивался".

---

# 55. Итоговый результат

Главный результат PLAN-005:

```text
Nexus 1.3
        ↓
Functional ecosystem
        ↓
PLAN-005
        ↓
Finished product experience
```

Пользователь должен открывать Nexus и сразу понимать:

```text
Что здесь происходит
Где искать
Что купить
Какие есть серверы
Кому можно доверять
Что происходит в сообществе
Что он может сделать сам
```

А интерфейс должен восприниматься не как:

```text
AI-generated prototype
```

а как:

```text
real product
```

Следующий большой этап после этого:

```text
Nexus 1.5
Nexus Module
Server Integration
Runtime Licensing
Capability System
Protected Asset Pipeline
```

Но только после того, как web-platform действительно закончена как продукт.