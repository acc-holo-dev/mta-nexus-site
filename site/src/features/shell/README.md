# Оболочка (shell)

Навигация, подвал, боковая панель и элементы управления темой и языком.

`shell`, `navbar`, `footer`, `sidebar`, `locale`, `session`, `auth-session` — публичные входы. `LocaleProvider` и `useNexusLocale` — из `locale.ts` (`components/locale-context.tsx`). Парсинг сессии, refresh-событие и destination policy — из `session.ts` (`session/`); клиентский `useAuthSession` — из `auth-session.ts`. Theme/locale toggles остаются внутренними компонентами navbar.

Маршруты остаются в App Router. Границы импортов проверяются dependency-cruiser и тестами архитектуры.
