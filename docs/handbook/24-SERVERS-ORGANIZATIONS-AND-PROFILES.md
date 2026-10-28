# 24. Servers, Organizations и Profiles

## 1. Server lifecycle

```text
Observed in MTA master list
  -> Public unclaimed entry
  -> Claim challenge
  -> Proof of control
  -> Ownership verification/moderation
  -> Claimed/managed server
  -> Optional Verified Server trust status
  -> Ongoing observations, content, team, analytics, promotion
```

Discovery не зависит от claim: все public master-list servers могут существовать в каталоге до регистрации владельца.

## 2. Claimed server page

После claim владелец получает широкую свободу оформления в безопасных рамках design system.

Target modules:

- logo/banner/media;
- description/rules;
- social/website links;
- current observed status;
- historical analytics;
- server updates/news;
- team roster;
- recruitment/vacancies;
- factions/clans;
- applications;
- events;
- related resources/content;
- community space;
- reviews/trust signals.

Owner-generated content никогда не заменяет live observation truth.

## 3. Server team

Публично поддерживаются роли вроде:

- Owner;
- Administrator;
- Developer;
- Moderator;
- Support.

Внутренние permissions могут быть granular и не обязаны один-в-один совпадать с публичными titles.

## 4. Server trust/reviews

OWNER-DELEGATED DECISION: не использовать одну star-rating как единственный рейтинг сервера.

Target reputation combines:

- verified interaction reviews;
- current/recent activity;
- observed availability/uptime-like signals;
- follows/community engagement;
- verified ownership;
- moderation/enforcement history;
- freshness of managed page/content.

UI может показывать reviews отдельно, а ranking объяснять несколькими сигналами.

## 5. Server Pro and promotion

Server Pro может давать:

- deeper history/analytics;
- page customization;
- more media;
- API/webhooks;
- alerts;
- team tools;
- automation;
- promotion allowance/discount/inventory.

Promotion availability зависит от выбранного subscription/tariff. Trust/verification never purchasable.

## 6. Organization as universal entity

Organization подходит для:

- development studio;
- server team;
- commercial team/business;
- community project;
- mixed team managing resources + servers + content.

Пользователь может состоять в нескольких organizations одновременно.

## 7. Organization governance

Нужны:

- invites;
- member roles;
- granular permissions;
- ownership transfer;
- billing owner;
- resource/server ownership;
- audit log;
- public profile;
- privacy settings;
- organization subscription/billing.

## 8. User profile privacy

Пользователь отдельно настраивает публичность:

- activity;
- purchases;
- resources;
- servers;
- organizations;
- achievements;
- portfolio;
- social links.

Security-sensitive/private commerce data не становится public только потому, что профиль «открытый».

## 9. Profile customization

Target profile supports:

- avatar;
- banner;
- bio;
- links;
- portfolio;
- showcase resources/servers;
- badges;
- achievements;
- activity.

Paid plans могут давать дополнительные visual customization options, но не trust status.

## 10. ownership, status и commerce-enabled organizations

### 10.1 Claim proof

DECISION: основной proof для claim остаётся текущим **MTA server challenge/control proof**. На этом этапе не добавлять DNS/website/file alternatives без конкретной необходимости.

Server-control proof и platform verification остаются разными понятиями: control доказывает управление endpoint/server, а Verified Server может учитывать дополнительные evidence/trust criteria.

### 10.2 Multiple owners

DECISION: claimed server может иметь нескольких co-owners. Data model должен отделять:

- legal/product ownership relation;
- public titles;
- operational permissions;
- organization membership.

Не моделировать co-owner простым текстовым badge.

### 10.3 Ownership transfer

Нужен explicit audited transfer user ↔ user/org с подтверждением сторон и safety checks. Transfer не должен происходить простым PATCH поля ownerId.

### 10.4 Server operational communication

Claimed servers могут публиковать структурированные состояния:

- maintenance;
- incident;
- scheduled restart;
- event;
- resolved/update notices.

Owner statement не переопределяет фактический observed online/offline state.

### 10.5 Join Server

DECISION: public server page имеет сильный `Join Server` action, endpoint copy/deep-link там, где клиент/браузер поддерживает безопасный способ.

Analytics может считать join-click/conversion events, но должна отличать `clicked join` от факта успешного входа игрока, если последний не доказан.

### 10.6 Player privacy

DECISION: по умолчанию не публиковать live player identity/names. Directory и analytics используют aggregate online/slots и другие минимально необходимые данные. Расширение telemetry требует отдельного privacy/product решения.

### 10.7 Organization billing and seller ownership

DECISION: Organization имеет собственный billing profile, а не только «карта конкретного участника». Organization может:

- владеть paid resources;
- выступать seller entity;
- получать provider-supported payouts;
- покупать subscriptions/services;
- иметь billing/admin permissions;
- иметь audit trail для коммерческих действий.

Конкретные KYC/legal requirements определяет provider/jurisdiction перед activation.

## 15. profile identity model

Public profiles are enabled by default for deliberately public fields, while purchases, email, payment, session/device, IP and private membership data remain private.

Every account has an immutable User ID. A paid subscription may add a vanity username/custom public slug. The vanity value does not replace immutable IDs in audit/payment/ownership records and cannot imitate staff/trust labels. Changing an already selected vanity username is a separate paid operation under the approved policy; immutable IDs remain authoritative in audit/payment/ownership records.

Verified external links (GitHub, Discord, domain/site and supported identities) prove account/domain control only; they are not a quality endorsement.