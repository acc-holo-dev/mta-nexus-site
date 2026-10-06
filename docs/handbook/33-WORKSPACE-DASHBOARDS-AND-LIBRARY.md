# MTA NEXUS — Workspace, Dashboards и Library

> Статус: OWNER DECISION / TARGET SPEC, Round 6.

## 1. Основной принцип

После авторизации пользователь **не перенаправляется автоматически в dashboard**. Он остаётся на обычной Home и сам открывает Workspace, когда ему нужны действия управления.

MTA NEXUS использует **единый адаптивный `/workspace`**, а не отдельные несвязанные кабинеты Seller, Buyer, Server Owner и Organization. Один человек может одновременно быть покупателем, разработчиком, владельцем нескольких серверов и участником нескольких организаций, поэтому интерфейс должен собирать его возможности в одном месте.

Workspace не является отдельной identity или ролью. Он строится из текущего actor context, ownership, permissions, subscriptions и доступных capabilities.

## 2. Верхний уровень Workspace

Рекомендуемый target navigation внутри `/workspace`:

- Overview;
- Library / Purchases;
- Resources;
- Servers;
- Organizations;
- Deals / Services;
- Support;
- Billing / Subscriptions;
- Security / Account shortcuts;
- Staff surfaces, если у пользователя есть staff capabilities.

Разделы, к которым нет доступа, не должны выглядеть как сломанные функции. Их можно скрывать либо показывать как понятный onboarding CTA, если пользователь действительно может получить capability.

## 3. Workspace Overview

Overview собирает только actionable информацию:

- непрочитанные notifications;
- pending moderation/review states;
- новые продажи и settlement events;
- support/dispute items, требующие ответа;
- server incidents/status alerts;
- expiring subscriptions/licenses;
- DRM/activation problems;
- organization invitations/tasks;
- security alerts.

Не превращать Overview в копию Home feed.

## 4. Seller / Creator dashboard

OWNER DECISION: seller dashboard должен поддерживать весь основной professional набор.

Минимальные блоки:

- revenue;
- gross sales / net settlement;
- pending/on-hold/available/paid amounts;
- 10% platform commission;
- PSP fees where known;
- views;
- conversion;
- sales by product/SKU;
- downloads/activations;
- product/build health;
- moderation states;
- reviews;
- refunds/disputes;
- unified support;
- promotions/ads;
- subscription status;
- payout/KYC/provider status;
- release/update activity.

Seller analytics не должна раскрывать лишние buyer PII.

## 5. Server Owner dashboard

OWNER DECISION: использовать полный professional набор:

- live status;
- current online aggregate;
- online/history charts;
- MTA directory observation health;
- incidents / maintenance / scheduled restart;
- ownership/co-owners;
- team and permissions;
- applications/recruitment;
- factions/clans/community links;
- events/content/news;
- reviews/reputation signals;
- Join Server analytics;
- promotion inventory;
- Server Pro state;
- alerts/notifications;
- claim/ownership transfer actions;
- server-specific community management.

Observed MTA state нельзя подменять ручными owner values.

## 6. Organization dashboard

Organization workspace объединяет:

- members;
- invitations;
- granular permissions;
- ownership transfer;
- servers;
- commercial and free resources;
- billing profile;
- payout profile;
- subscriptions;
- deals/services;
- support;
- audit log;
- security-sensitive actions.

Organization является полноценным economic actor: она может владеть commercial resources и получать payouts, если provider/legal model это позволяет.

## 7. Buyer Library

OWNER DECISION: библиотека делится на понятные режимы:

- `Purchased`;
- `Free` / claimed;
- `Trials`;
- `Licenses`;
- `Updates`;
- `Support`;
- `Invoices` / receipts.

Фильтры могут дополнительно включать product type, seller, server binding, DRM state, update availability и access expiration.

## 8. Purchase detail page

Для каждого order item/purchase нужна отдельная страница, где пользователь видит:

- product и выбранный SKU/edition;
- seller/entity;
- фактически оплаченную цену и валюту;
- order/payment identifiers;
- current version;
- download availability;
- license state;
- bound MTA server;
- DRM activation/lease state when enabled;
- update history;
- support entitlement и срок;
- receipt/invoice;
- dispute/refund actions;
- security/takedown notices;
- 30-day transition notice при delist/seller-ban, если применимо.

Client-side success state никогда не заменяет server-authoritative purchase/license state.

## 9. Cross-role UX

Один User может иметь несколько contexts. Переключение personal/organization context должно:

1. проверять membership/permissions на сервере;
2. менять active context атомарно;
3. писать audit event;
4. обновлять navigation и доступные actions;
5. не давать historical ownership bypass.

## 10. Что не делать

- не создавать отдельные accounts для Buyer/Seller/Server Owner;
- не отправлять каждого пользователя в dashboard сразу после login;
- не дублировать Home внутри Workspace;
- не показывать finance/admin widgets без permission;
- не создавать role-specific frontend, который невозможно совместить для multi-role user;
- не считать subscription эквивалентом trust/verification.