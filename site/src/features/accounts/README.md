# Аккаунты

Формы входа и регистрации, управление аккаунтом и настройки безопасности.

`auth`, `controls`, `settings`, `context`, `profile`, `change-history`, `profile-change-history`, `profile-pagination`, `developer-experience`, `ad-preference` — клиентские и shared UI входы. `ad-preference` — cookie opt-out helpers для рекламных слотов (UX-26). `developer-experience` — RSC-порт публичной карточки verified developer (user/developer profile pages). `change-history` — фильтры/ссылка; `profile-change-history` — полный view с query helpers. `public-profile-activity-server.ts` — server-only публичная лента активности профиля. `ContextSwitcher` — из `context.ts`. Настройки уведомлений используют публичный вход Notifications.

Внутренние компоненты не являются публичным API. Маршруты остаются в App Router; сервисы, авторизация, доступ к данным и существующие правила предметной области сохраняются в прежних слоях. Границы импортов проверяются dependency-cruiser и тестами архитектуры.
| `settings-client-api.ts` | util port `settings-client-api` |
| `feature-flags.ts` | util port `feature-flags` |
| `profile-privacy-copy.ts` | util port `profile-privacy-copy` |
| `session-revocation.ts` | util port `session-revocation` |
| `account-recovery-request-policy.ts` | util port `account-recovery-request-policy` |
| `account-recovery-browser.ts` | util port `account-recovery-browser` |
| `session-cookie.ts` | util port `session-cookie` |
| `profile-change-history-contract.ts` | util port `profile-change-history-contract` |
| `profile-privacy-contract.ts` | util port `profile-privacy-contract` |
