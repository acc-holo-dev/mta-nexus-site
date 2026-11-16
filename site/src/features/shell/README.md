# Оболочка (shell)

Навигация, подвал, боковая панель и элементы управления темой и языком.

`shell`, `navbar`, `footer`, `sidebar`, `locale` — публичные входы. `LocaleProvider` и `useNexusLocale` экспортируются из `locale.ts`; реализация — `components/locale-context.tsx`. Theme/locale toggles остаются внутренними компонентами navbar. Политики сессии пока остаются в `components/`.

Маршруты остаются в App Router. Границы импортов проверяются dependency-cruiser и тестами архитектуры.
