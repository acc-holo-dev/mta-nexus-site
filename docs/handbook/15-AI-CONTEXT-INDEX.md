# Карта предметных областей

| Область | Код | Решения |
|---|---|---|
| Авторизация и безопасность | `apps/web/src/lib/services/auth-service.ts`, `packages/security`, `packages/db/src/repositories/auth.ts` | [Учётная запись](38-ACCOUNT-AUTH-AND-LIFECYCLE.md), [безопасность](04-TRUST-SAFETY-SECURITY.md) |
| Ресурсы и доставка | product/build services, `packages/storage`, репозитории builds | [Жизненный цикл](23-MARKETPLACE-PRODUCT-LIFECYCLE.md), [доставка](34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md) |
| Библиотека и корзина | library/cart services; коллекции: `library-collections.ts` — чтение, `library-collection-command.ts` — подготовка и запись, `library-membership-batches.ts` — пакетная оркестрация, `library-collection-internals.ts` — общие проекции и ограничения | [Доступ](28-CART-LICENSES-AND-ACCESS-RIGHTS.md), [сценарии](46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md) |
| Серверы и организации | server/organization services и репозитории | [Серверы](30-SERVER-OWNERSHIP-STATUS-AND-JOIN.md), [организации](49-ORGANIZATION-SCREENS.md) |
| Сообщество и уведомления | content/discussion/follow services, workers | [Сообщество](19-COMMUNITY-AND-RETENTION.md), [уведомления](41-PWA-THEMES-ACCESSIBILITY-AND-NOTIFICATIONS.md) |
| Модерация и доверие | report/admin/verification services; `community-reports.ts`, очередь групп — `private-community-report-groups.ts`, общие ограничения — `private-community-report-scope.ts` | [Модерация](40-STAFF-CASEWORK-GOVERNANCE-AND-QUEUES.md), [доверие](53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md) |
| Интерфейс | `packages/ui`, `globals.css`, i18n | [Дизайн](05-UX-AND-DESIGN.md), [роли](43-ROLE-SURFACE-MAP.md) |
| База и эксплуатация | `packages/db`, migrations, `scripts`, CI | [Модель данных](08-DOMAIN-AND-DATA-MODEL.md), [эксплуатация](../OPERATIONS.md) |
| Будущая коммерция | commerce/license services и репозитории | [Решения](13-DECISION-REGISTER.md), [экономика](52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md), [лицензии](54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md) |

Открывайте только относящиеся к задаче разделы. Проверяйте код и тесты: спецификация может описывать целевое состояние.
