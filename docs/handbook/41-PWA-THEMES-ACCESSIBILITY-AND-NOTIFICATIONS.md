# MTA NEXUS — PWA, Themes, Accessibility и Notifications

> Статус: OWNER DECISION / TARGET SPEC.

## Технические границы

Точные ограничения и поведение проверяйте в коде: [offline cache policy](../../apps/web/src/lib/offline-cache-policy.ts), [Web Push runtime](../../packages/db/src/web-push-runtime.ts), репозитории `web-push-*` и `web-push-settings.tsx`.

- Offline cache допускает только явно разрешённые анонимные read-only документы с серверным opt-in; приватные страницы, API и изменения данных не получают фиктивный offline success.
- Push-подписка привязана к действующей сессии; endpoint и криптографические параметры валидируются, конфликты и смена VAPID обрабатываются явно.
- Durable outbox хранит ограниченные задания с lease/retry/settlement. Приём задания и protocol test не доказывают доставку внешним провайдером.
- Health различает heartbeat, прогресс обработки и давление очереди. Процедуры диагностики и восстановления находятся в [OPERATIONS](../OPERATIONS.md).
- Приёмка целевой сети, длительный soak, live provider и screen-reader/WCAG audit проверяются перед релизом отдельно; локальные результаты не заменяют эти свидетельства.

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

Password-reset security invariant: Web Push remains strictly session-bound. A successful password reset changes the password, revokes every session, cascade-deletes their web_push_subscriptions, writes the audit event and a durable security inbox notification in the same transaction. Therefore reset intentionally does not send post-commit push to revoked endpoints; the notification is available on the next login and an old device keeps no delivery capability.
