# Оболочка (shell)

Навигация, подвал, боковая панель и элементы управления темой и языком.

`shell`, `navbar`, `footer`, `sidebar` — публичные входы. Theme/locale toggles остаются внутренними компонентами navbar. `locale-context` и политики сессии пока остаются в `components/`.

Маршруты остаются в App Router. Границы импортов проверяются dependency-cruiser и тестами архитектуры.
