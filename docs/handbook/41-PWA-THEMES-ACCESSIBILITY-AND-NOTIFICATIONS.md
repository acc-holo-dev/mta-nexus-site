# MTA NEXUS — PWA, Themes, Accessibility и Notifications

> Статус: OWNER DECISION / TARGET SPEC, Round 7.

## CURRENT implementation status — 2026-10-07

В `main` реализован первый безопасный PWA slice:

- installable Web App Manifest и maskable-capable SVG icon;
- production-only registration service worker;
- network-first navigation: при отсутствии сети показывается self-contained offline shell;
- service worker не кеширует HTML пользовательских страниц и не перехватывает non-GET mutations;
- offline shell явно сообщает, что покупки, публикация, модерация и другие state-changing actions не подтверждаются без authoritative server response.

Ещё не закрыты target requirements этой главы: **Web Push**, **System theme**, расширенная стратегия read-only public cache и полный WCAG 2.2 AA acceptance pass.

## 1. Public release quality bar

Public release target включает:

- installable PWA;
- responsive desktop/mobile UI;
- safe offline shell;
- Web Push;
- Light / Dark / System themes;
- WCAG 2.2 AA target для ключевых account/commerce flows.

Это часть release experience, а не «когда-нибудь polish».

## 2. Offline/PWA boundary

Offline допустим для:

- shell/navigation;
- cached public content where cache policy permits;
- drafts, если conflict model безопасен;
- read-only previously loaded surfaces.

Offline **не подтверждает**:

- purchase/payment;
- license activation/transfer;
- publish/moderation;
- ownership transfer;
- finance actions;
- security actions.

State-changing success показывается только после authoritative server confirmation.

## 3. Themes

Minimum theme modes:

- Light;
- Dark;
- System.

Semantic design tokens должны покрывать trust states, moderation warnings, charts, code, forms и accessibility contrast. Paid customization не должна ломать WCAG/trust identity.

## 4. Accessibility

WCAG 2.2 AA target прежде всего для:

- auth/recovery;
- cart/checkout;
- product purchase/download/license;
- support/dispute;
- publish wizard;
- server claim;
- Security Center;
- moderation/appeal communication.

Acceptance включает keyboard-only use, visible focus, logical headings, form errors, dialog focus management, reduced-motion compatibility, zoom/reflow и screen-reader semantics.

## 5. Notification channels

Release target channels:

- in-app;
- email;
- Web Push.

Telegram/Discord bots отложены.

## 6. Mandatory vs optional notifications

Пользователь не может полностью отключить сообщения, необходимые для безопасности, платежей или закона, например:

- security incident/account recovery;
- payment/refund/dispute critical state;
- license/security revocation;
- malware exposure;
- legal/terms notices where required.

Community, marketing, recommendations и promotional notifications настраиваются/отключаются.

## 7. Mobile navigation

Bottom nav:

- Home;
- Servers;
- Market;
- Community;
- More.

Messages, Notifications, Discover, Workspace/Profile и Support доступны через More/header/badges.