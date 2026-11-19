# Notifications: inbox и настройки

Feature объединяет существующие колокольчик, inbox, вкладки, настройки и Web Push.
Сессия, actor identity, серверная авторизация, сервисы доставки, outbox и workers
остаются прежними.

| Entry                                      | Контракт                                                            |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `bell.ts`                                  | `NotificationBell`; клиентский колокольчик                          |
| `preferences.ts`                           | `SettingsNotificationPreferencesSection`; клиентские настройки      |
| `notification-inbox-events.ts`             | `announceNotificationInboxChange`, `observeNotificationInboxChange` |
| `visible-polling.ts`                       | `startVisiblePolling` (visibility-aware poll helper)                |
| `notification-inbox-export-client.ts`      | Inbox page export fetch/validate (`fetchNotificationInboxExport`)   |
| `center-server.ts`                         | Страница inbox и metadata; server-only                              |
| `notification-inbox-copy.ts`               | util port `notification-inbox-copy`                                 |
| `notification-read.ts`                     | util port `notification-read`                                       |
| `notification-preferences-confirmation.ts` | util port `notification-preferences-confirmation`                   |
| `notification-copy.ts`                     | util port `notification-copy`                                       |
| `notification-inbox-contract.ts`           | util port `notification-inbox-contract`                             |
| `notification-mark-read-api-copy.ts`       | util port `notification-mark-read-api-copy`                         |
| `web-push-subscription.ts`                 | util port `web-push-subscription`                                   |

Inbox, вкладки и Web Push являются внутренними компонентами feature. Внешний
production-код использует публичные входы; маршруты не импортируются feature.
Client graph проверяется на отсутствие серверных модулей, инфраструктуры и Node
builtins. Подтверждение действий, actor/session identity, восстановление и события
синхронизации сохраняют существующее поведение.

Focused bell suites (effects, identity, interaction, preview surface) живут в
`site/tests/database/notification-bell*.test.tsx`, не в `components/`.
