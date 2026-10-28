# 31. Organization Commerce и Messaging Policy

## 1. Organization as commercial principal

Organization может быть не только team wrapper, но и коммерческой стороной:

- owns resources;
- seller identity;
- receives provider-supported payouts;
- buys subscriptions;
- owns server pages;
- opens/participates in deals;
- owns support responsibilities.

## 2. Organization billing profile

Billing profile принадлежит Organization и отделён от personal profile участника.

Target fields/capabilities:

- legal/display entity data where required;
- provider merchant/subaccount reference;
- payout configuration;
- billing contacts;
- tax/invoice data where applicable;
- billing permissions;
- full audit log.

Secrets/provider tokens не отображаются обычным admins.

## 3. Finance permissions

Granular permissions минимум:

- view_finance;
- manage_billing;
- manage_payouts;
- view_orders;
- handle_refunds/disputes where policy permits;
- buy_subscriptions;
- manage_seller_products.

Step-up authentication required for high-risk finance changes.

## 4. Default messaging policy

Для незнакомых пользователей default — Message Request.

Direct contextual communication разрешена для:

- buyer/seller support case;
- Deal participants;
- Organization members;
- server team members;
- approved private group participants;
- staff case communication.

## 5. Block semantics

Block stops private/social interaction, но не может скрывать обязательный financial/dispute/audit notice.

## 6. Private groups

Invite-only groups/spaces поддерживаются. Group privacy не отменяет platform abuse moderation/reporting.

## 7. No native calls

Voice/video calls не входят в NEXUS scope. External Discord/Telegram links/integrations are preferred.

## 12. organization permission templates и critical actions

Organization использует одновременно готовые permission templates и granular capabilities.

Минимальные templates:

- Owner;
- Admin;
- Developer;
- Support;
- Finance;
- Content.

Templates — удобные presets, а authorization всё равно проверяет конкретные capabilities.

Critical actions требуют re-authentication и audit:

- ownership transfer;
- payout destination/billing identity changes;
- выдача Finance capability;
- permanent deletion/archive where destructive;
- other high-risk actions по security policy.

Дополнительно нужны invitation links с:

- expiry;
- max uses;
- target role/template;
- revoke;
- audit;
- optional domain/verification restrictions in future.

Персональные invites при этом сохраняются.