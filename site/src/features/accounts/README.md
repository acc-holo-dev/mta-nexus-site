# Аккаунты

Формы входа и регистрации, управление аккаунтом и настройки безопасности.

`auth`, `controls`, `settings`, `context`, `profile`, `change-history`, `profile-change-history`, `profile-pagination`, `developer-experience`, `ad-preference` — клиентские и shared UI входы. `ad-preference` — cookie opt-out helpers для рекламных слотов (UX-26). `developer-experience` — RSC-порт публичной карточки verified developer (user/developer profile pages). `change-history` — фильтры/ссылка; `profile-change-history` — полный view с query helpers. `public-profile-activity-server.ts` — server-only публичная лента активности профиля. `ContextSwitcher` — из `context.ts`. Настройки уведомлений используют публичный вход Notifications.

Внутренние компоненты не являются публичным API. Маршруты остаются в App Router; сервисы, авторизация, доступ к данным и существующие правила предметной области сохраняются в прежних слоях. Границы импортов проверяются dependency-cruiser и тестами архитектуры.
