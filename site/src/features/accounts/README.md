# Аккаунты

Формы входа и регистрации, управление аккаунтом и настройки безопасности.

`auth`, `controls`, `settings`, `context`, `profile`, `change-history`, `profile-change-history`, `profile-pagination` — клиентские и shared UI входы. `change-history` — фильтры/ссылка; `profile-change-history` — полный view с query helpers. `public-profile-activity-server.ts` — server-only публичная лента активности профиля. `ContextSwitcher` — из `context.ts`. Настройки уведомлений используют публичный вход Notifications.

Внутренние компоненты не являются публичным API. Маршруты остаются в App Router; сервисы, авторизация, доступ к данным и существующие правила предметной области сохраняются в прежних слоях. Границы импортов проверяются dependency-cruiser и тестами архитектуры.
