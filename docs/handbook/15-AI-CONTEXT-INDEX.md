# Карта предметных областей

Сначала структура репозитория и команды: [PROJECT-MAP](../PROJECT-MAP.md). После DOC-04 handbook-главы по сценариям удалены; читайте сводные контракты. Полный реестр решений: [13-DECISION-REGISTER.md](13-DECISION-REGISTER.md).

| Область | Код | Контракт |
| --- | --- | --- |
| Авторизация и безопасность | auth-service, `packages/security`, auth repos | [TRUST-STAFF](../TRUST-STAFF.md) |
| Ресурсы и доставка | product/build, storage, builds repos | [RESOURCES](../RESOURCES.md) |
| Библиотека и корзина | library/cart; `library-collections*` | [RESOURCES](../RESOURCES.md), [COMMERCIAL-FUTURE](../COMMERCIAL-FUTURE.md) |
| Серверы и организации | server/organization services | [SERVERS-ORGS](../SERVERS-ORGS.md) |
| Сообщество и уведомления | content/discussion/follow, workers | [COMMUNITY](../COMMUNITY.md), [FLOWS](../FLOWS.md) |
| Модерация и доверие | report/admin/verification; community-reports* | [TRUST-STAFF](../TRUST-STAFF.md) |
| Интерфейс | `packages/ui`, `globals.css`, i18n | [UX-CONTRACT](../UX-CONTRACT.md), [PRODUCT](../PRODUCT.md) |
| База и эксплуатация | `packages/db`, migrations, `scripts`, CI | [ARCHITECTURE](../ARCHITECTURE.md), [OPERATIONS](../OPERATIONS.md) |
| Будущая коммерция | commerce/license services | [COMMERCIAL-FUTURE](../COMMERCIAL-FUTURE.md) |

Открывайте только относящиеся к задаче разделы. Проверяйте код и тесты: спецификация может описывать целевое состояние. Исторические главы — в Git.
