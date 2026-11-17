# Поддержка

Обращения, переписка, история статусов и переход к помощи по загрузке.

`center`, `thread`, `download-help` — клиентские входы; `page-server`, `messages-server` — серверные страницы.

Внутренние компоненты не являются публичным API. Маршруты остаются в App Router; сервисы, авторизация, доступ к данным и существующие правила предметной области сохраняются в прежних слоях. Границы импортов проверяются dependency-cruiser и тестами архитектуры.

Focused localization suite for `SupportCenter` (staff filters, attached context) lives in
[`site/tests/database/support-center.test.tsx`](../../../tests/database/support-center.test.tsx), not in `components/`.
| `support-message-discovery-copy.ts` | util port `support-message-discovery-copy` |
| `support-response.ts` | util port `support-response` |
