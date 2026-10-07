# MTA NEXUS — PWA, Themes, Accessibility и Notifications

> Статус: OWNER DECISION / TARGET SPEC, Round 7.

## CURRENT implementation status — 2026-10-07

В `main` реализован первый безопасный PWA slice:

- installable Web App Manifest и maskable-capable SVG icon;
- production-only registration service worker;
- Light / Dark / System theme modes; System реагирует на изменение OS color scheme без перезагрузки;
- network-first navigation: при отсутствии сети показывается self-contained offline shell;
- service worker не кеширует HTML пользовательских страниц и не перехватывает non-GET mutations;
- добавлены session-bound browser Web Push subscriptions: authenticated subscribe/unsubscribe API, VAPID public-key gate и safe same-origin notification click handling; завершение серверной session каскадно удаляет её push subscription;
- offline shell явно сообщает, что покупки, публикация, модерация и другие state-changing actions не подтверждаются без authoritative server response.

Chromium release acceptance теперь также покрывает RU/EN login и password-recovery UI, а после реального входа — Settings, Security Center, Support и Publish: keyboard focus, accessible labels, live error/status semantics, reduced-motion и reflow на 320/390/1280 px. Это scoped browser acceptance, не полная screen-reader/WCAG-сертификация.

Ещё не закрыты target requirements этой главы: **Web Push delivery/dispatcher и production VAPID wiring**, расширенная стратегия read-only public cache, server-claim/commerce accessibility acceptance и полный WCAG 2.2 AA screen-reader/contrast audit.

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