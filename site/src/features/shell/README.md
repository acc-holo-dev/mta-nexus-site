# Оболочка (shell)

Навигация, подвал, боковая панель и элементы управления темой и языком.

`shell`, `navbar`, `footer`, `sidebar`, `locale`, `session`, `auth-session`, `auth-return`, `guest-auth`, `session-error`, `modal-dialog`, `home-personal` — публичные входы. Безопасный post-auth return path (`parseAuthReturnPath`, `authEntryHref`, …) — из `auth-return.ts`. Гостевые ссылки и `PlatformSignIn` — из `guest-auth.ts`. `PlatformSessionError` для session recovery — из `session-error.ts`. Native `<dialog>` focus/backdrop helpers (`useModalDialog`, `clickedDialogBackdrop`) — из `modal-dialog.ts`. Home personal changes panel (`HomePersonalChangesPanel`, copy ids) — из `home-personal.ts`. `LocaleProvider` и `useNexusLocale` — из `locale.ts` (`components/locale-context.tsx`). Парсинг сессии, refresh-событие и destination policy — из `session.ts` (`session/`); клиентский `useAuthSession` — из `auth-session.ts`. Theme/locale toggles остаются внутренними компонентами navbar.

Маршруты остаются в App Router. Границы импортов проверяются dependency-cruiser и тестами архитектуры.
