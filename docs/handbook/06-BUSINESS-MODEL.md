# 06. Бизнес-модель, оплаты, подписки и преимущества

> Owner review rounds 1–4 incorporated: 2026-10-06.

## 1. Current stage vs target business

### CURRENT: closed beta

Текущий `mta-nexus-site` всё ещё работает как бесплатная closed beta:

- аккаунты и публичные поверхности бесплатны;
- resource acquisition построен вокруг free claim/entitlement;
- paid checkout/payout/crypto settlement не активированы;
- активный DRM-commerce не включён;
- production payment/legal model ещё не утверждён.

Это **этап реализации**, а не финальная бизнес-модель.

### OWNER-CONFIRMED TARGET

Целевой NEXUS включает:

- бесплатные и платные ресурсы;
- marketplace commission **10%**;
- платные подписки для разных ролей/направлений;
- разовые платные функции и upgrades;
- commercial licenses/entitlements;
- обязательный DRM-направление для коммерческой экосистемы;
- возможность монетизировать широкий спектр полезных возможностей сайта.

## 2. Главный экономический принцип

Базовая marketplace-модель:

`Успешная продажа → продавец получает доход → NEXUS получает 10% комиссии.`

Комиссия 10% подтверждена владельцем как базовая продуктовая ставка. Точная бухгалтерская формула всё ещё должна определить, считается ли 10% от gross/final price до или после PSP fee/налогов/возвратов.

## 3. Что может приносить деньги

OWNER DECISION: монетизация не ограничивается одним marketplace. Подписки и разовые покупки могут применяться везде, где пользователь получает реальную дополнительную ценность.

Потенциальные revenue streams:

- 10% marketplace commission;
- Creator/Developer subscriptions;
- Server Owner subscriptions;
- Organization/team plans;
- advanced analytics;
- automation;
- API/webhooks;
- расширенная кастомизация;
- дополнительные media/storage/limits;
- promoted placements/advertising;
- one-time boosts/upgrades/features;
- commercial services/deals;
- платные инструменты DRM/licensing/updates;
- позже — инфраструктурные и профессиональные сервисы.

DECISION: планы могут быть разными для разных pillars и иметь несколько уровней; кроме специализированных планов допустим объединяющий `NEXUS Pro`/bundle. Точные цены — OPEN.

## 4. Free tier

Free tier всё равно нужен: он создаёт аудиторию, discovery и доверие. Но owner decision не устанавливает вечный список функций, которые запрещено монетизировать.

Рабочий принцип:

- бесплатный пользователь должен понимать и использовать платформу;
- premium должен давать дополнительную ценность, скорость, масштаб, автоматизацию, удобство или продвижение;
- платёж не должен превращать ложное утверждение в «verified» и не должен разрушать техническую безопасность.

## 5. Seller model

Отдельная обязательная заявка `Become Seller → manual approval` **не нужна**.

Основная проверка применяется к продукту:

`Creator submits Product → safety checks → moderation/policy → publication`

Это снижает friction: пользователь не доказывает право быть продавцом до того, как у него вообще есть конкретный продукт.

### Subscription/automation

Платные планы могут давать:

- автоматизацию публикационного workflow;
- priority processing;
- release automation;
- scheduled releases;
- GitHub/webhook integration;
- bulk operations;
- advanced analytics;
- custom storefront;
- team/organization tooling;
- дополнительные лимиты.

**DECISION:** auto-publish относится к subscription entitlement: подписчик может обходить ручную moderation queue согласно policy, но не malware scan, artifact integrity, ownership/authz или обязательные automated safety/policy checks.

## 6. Product moderation

OWNER DECISION: основной объект модерации — **сам продукт/релиз**, а не право пользователя быть seller.

Нужно отдельно определить:

- первая публикация vs последующие версии;
- ручная модерация каждого build или risk-based automation;
- что получает paid plan;
- условия auto-publish;
- post-publication audit;
- emergency takedown;
- повторная модерация при существенных изменениях.

## 7. Purchase / Payment / License separation

Сохраняется сильный legacy-принцип:

`Purchase != Payment != License/Entitlement`.

- **Purchase** — коммерческий факт/намерение приобретения.
- **Payment** — работа конкретного PSP/provider.
- **License/Entitlement** — право получить/использовать продукт.
- **DRM state** — техническое состояние контролируемого использования, если применимо.

Это разделение должно сохраняться независимо от выбранного платёжного провайдера.

## 8. Marketplace pricing

Подтверждено:

- paid resources нужны;
- комиссия NEXUS — 10%.

OPEN:

- minimum/maximum price;
- currencies;
- regional pricing;
- discounts/promocodes;
- кто платит PSP fee;
- tax/VAT handling;
- chargebacks;
- refund windows;
- commission on refunds;
- payout reserve.

## 9. Subscriptions

Paid subscriptions подтверждены как часть стратегии. Они могут существовать у разных ролей, а рядом с ними допустимы one-time purchases.

### Возможные планы

**Creator / Developer Pro**

- advanced analytics;
- automation;
- API/webhooks;
- release channels;
- custom storefront;
- team tools;
- additional limits;
- priority/automated publication workflow.

**Server Pro**

- richer page customization;
- deeper historical analytics;
- alerts;
- webhooks/API;
- advanced team/staff tools;
- media/branding;
- promotion/marketing tools.

**Organization Pro**

- multiple members/roles;
- shared ownership;
- audit and team workflows;
- organization analytics;
- automation/integrations.

Названия и состав не утверждены.

## 10. One-time monetization

Разовые платежи допустимы наряду с подписками. Примеры-кандидаты:

- временное продвижение resource/server;
- дополнительный marketing slot;
- одноразовый аудит/проверка;
- extra storage/media pack;
- разовая расширенная аналитическая выгрузка;
- premium publishing/release operation;
- paid customization item.

Каждый такой продукт должен иметь понятную ценность и не маскироваться под обязательную системную комиссию.

## 11. Promotion and advertising

Promoted resources/servers допустимы как revenue stream, но в UI должны быть отличимы от organic/trust ranking.

Правило: деньги могут купить **показ**, но не должны фальсифицировать факт безопасности, владения или реальной пользовательской оценки.

## 12. DRM — обязательная часть коммерческого направления

OWNER DECISION: DRM capability нужна обязательно, но продавец включает DRM опционально для конкретного продукта.

Это меняет legacy status: DRM больше не просто идея на случай будущего marketplace. Он является целевым компонентом коммерческой архитектуры.

Возможные функции:

- commercial license;
- installation binding;
- server binding;
- challenge/activation;
- signed lease;
- offline grace period;
- revocation/suspension;
- controlled update delivery;
- optional encrypted artifact/key delivery;
- forensic watermark/attribution;
- license manager/module.

Rounds 2–3 зафиксировали target flow `Purchase → License → Installation/Server → Activation → Lease`, 7-day offline grace, universal runtime/module без recompilation per customer/server, **hard stop после grace** и базовое правило переноса: один бесплатный transfer примерно раз в 30 дней, более частые/особые случаи через support. Forensic watermark layer confirmed as seller-opt-in evidence: individual marker/package, no per-customer runtime recompilation and no automatic ban from one signal.

### Honest security claim

DRM не обещает абсолютную невозможность копирования или reverse engineering. Его задача — сделать массовое пиратство дороже, управлять лицензиями, отзывом доступа, обновлениями и доказуемой выдачей.

## 13. Services / custom work / guarantee

Это логичное расширение экосистемы, но юридически и операционно сложнее обычной продажи файла.

Потенциальные категории:

- custom development;
- server setup;
- design/UI;
- maps/assets;
- consulting;
- maintenance.

Guarantee/deal требует funding, delivery evidence, verification, dispute and settlement lifecycle. Статус направления пока OPEN.

## 14. Payouts and ledger

Для marketplace 10% комиссии понадобится объяснимый финансовый контур:

- immutable order snapshots;
- commission split;
- payment reconciliation;
- seller accrued/pending/available amounts;
- refunds/chargebacks;
- payout schedule;
- reserve;
- audit.

Текущий closed beta ledger/schema нельзя считать готовым production payout system.

## 15. Trust and monetization

Owner допускает широкую monetization. Поэтому запреты должны быть минимальными и основанными на честности продукта, а не на догме «это всегда бесплатно».

Нельзя продавать **ложь**:

- fake Verified;
- fake clean scan;
- fake rating/review;
- скрытую подмену organic result рекламой;
- доступ к данным, которые пользователь не соглашался раскрывать.

Можно монетизировать аудит, инструменты, оформление, продвижение и automation. **Verification и её результат не продаются:** owner explicitly rejected paid verification. Она выдаётся только по evidence и выполненным критериям.

## 16. Owner decisions — commerce round 2

### Payment coverage

OWNER DECISION: архитектура должна быть multi-provider и multi-method. Цель — подключать максимально широкий набор законных и practically доступных способов оплаты, а не привязывать NEXUS к одной стране/одному PSP. Exact launch provider set зависит от jurisdiction, fees, KYC, chargeback rules и availability.

### Payout operating principle

OWNER DECISION: выбирать схему с минимумом ручных операций и расходов владельца бизнеса. Preferred direction — marketplace/split settlement/provider-managed KYC/payout/reconciliation, если это доступно и экономически разумно. Собственный internal payout ledger — fallback с большей operational/legal responsibility.

### Disputes

OWNER DECISION: полноценная dispute system обязательна. Минимальный flow: `Purchase → dispute opened → evidence → payout/funds protection where possible → review → resolution → refund/release/partial outcome → audit`. Bank/PSP chargeback остаётся отдельным, но связанным процессом.

### Promotion

OWNER DECISION: sponsored placement для server/resource surfaces допустим. Реклама должна быть явно маркирована и не менять organic/trust/security truth.

### Subscription auto-publish

OWNER DECISION: manual product moderation — default. Auto-publish доступен только по подписке и может bypass manual queue, но mandatory automated safety/integrity/policy checks выполняются всегда.

### Verification

OWNER DECISION: verification нельзя покупать. Она подтверждает опыт, контроль, выполненные заказы/продажи или другие доказуемые свойства.

## 17. Remaining business questions

Остаётся определить: launch jurisdiction/providers/currencies, tax/VAT/invoicing ownership, точные refund/chargeback rules, payout intervals/reserves, subscription tiers/prices, promotion pricing/inventory и services/guarantee priority.


## 19. Round 3 monetization decisions

### 19.1 Subscription topology

DECISION: NEXUS может иметь одновременно:

- specialized pillar plans, например Creator/Developer, Server, Organization и другие по мере появления value;
- разные уровни внутри pillar вместо искусственно одинаковой сетки;
- общий bundle / `NEXUS Pro`, объединяющий преимущества нескольких направлений.

Планы не обязаны иметь одинаковые features или названия.

### 19.2 Flexible term

DECISION: платный доступ может продаваться на настраиваемый срок приблизительно **от 7 дней до 1 года**. Billing layer должен уметь выражать term entitlement независимо от конкретного PSP. Recurring renewal может быть дополнительным способом покупки там, где провайдер и UX это поддерживают.

### 19.3 One-time purchases

DECISION: основной смысл one-time monetization — временная реклама/продвижение и отдельные операционные/publishing услуги, а не продажа косметики ради косметики. Profile customization в первую очередь value подписки.

Нельзя one-time платежом обходить security gates, покупать verification, стирать санкции или покупать органический trust/reputation.

### 19.4 Advertising

DECISION: на первом этапе рекламный inventory продаётся по **фиксированной цене**, а не через auction/bidding. Sponsored placements маркируются как sponsored и не подменяют organic/trust ranking.

### 19.5 Open/closed source commerce

DECISION: marketplace допускает open-source и closed-source продукты. Seller может предлагать исходный код как отдельный SKU/license tier с более высокой ценой, другими правами использования или отдельным entitlement. Source purchase не должен автоматически означать transfer of copyright/IP unless license explicitly says so.

## 24. Owner decisions — Round 4 commercial model

### 24.1 Первый market vertical

Первый коммерческий фокус — **MTA Scripts**. Архитектура может быть расширяемой, но не нужно размывать initial marketplace десятками категорий до появления качественного core flow.

### 24.2 Delivery и license variants

Основные варианты:

- **Closed code** — продавец решает, включать ли DRM;
- **Open source** — DRM не применяется;
- Free edition и Premium edition могут сосуществовать;
- bundles разрешены;
- source code может быть отдельной более дорогой коммерческой лицензией/variant там, где продукт closed-source по умолчанию.

### 24.3 Price and promotions

- Seller сам устанавливает цену.
- Hard minimum price не является продуктовым правилом.
- Coupons, promo codes, seller discounts и platform campaigns разрешены.
- NEXUS commission = **10% от фактически оплаченной покупателем суммы после скидки**.
- PSP/provider fees учитываются по правилам конкретного провайдера, а не одной глобальной формулой.

### 24.4 Updates

По умолчанию покупка даёт будущие обновления бесплатно. Version history и changelog обязательны для зрелого commercial listing. Если когда-нибудь появится paid major-upgrade model, это должно быть новым явным решением, а не скрытым поведением.

### 24.5 Settlement reserve

Base payout hold — **7 дней**. Он может сокращаться/изменяться для подписчиков и доверенных/verified sellers по прозрачной risk policy. Это не «покупка доверия»: subscription может давать operational privilege, а verification остаётся evidence-based.

### 24.6 Refunds

Seller не может в одностороннем порядке вернуть деньги вне платформенного flow. Refund/dispute должен сохранять финансовый журнал, причины, status transitions и согласованное состояние entitlement/license.

### 24.7 Services marketplace

Services/custom development входит в target commercial platform. Для него нужен `Deal / Guarantee` lifecycle с protected funding, deliverables, evidence, acceptance/dispute и provider-aware settlement.

### 24.8 Seller agreement

Перед первой продажей пользователь принимает отдельный Seller/Publishing Agreement. Его юридическое содержание, jurisdiction и tax wording не определяются AI автоматически.

### 24.9 Age policy

Владелец не хочет отдельную продуктовую age-gate policy. Однако NEXUS обязан соблюдать минимальный возраст/consent/KYC требования применимого закона и payment provider: это external constraint, а не optional feature.


## Round 9 owner sync — commercial economics

- Baseline marketplace commission remains **10% for all sellers** at this stage.
- Creator subscriptions may later reduce the commission; exact percentages and eligibility are still product-pricing decisions.
- A new seller starts with a **7-day payout hold**. Subscription, verification and healthy transaction history may shorten the hold, potentially toward 1–3 days.
- `Creator Free` remains a real free tier with manual product moderation.
- Paid Creator capabilities may add auto-publish, advanced analytics, automation and promotion advantages without bypassing technical/security gates.
- A seller without subscription may purchase a one-off accelerated/automated publication service for a specific resource, again without bypassing safety/policy checks.
- `Server Pro` may have several tiers and also coexist with one-time promotion purchases.
- `Organization Pro` is billed per organization rather than per seat by default.
- `NEXUS Pro` is the maximal cross-ecosystem bundle. Exact included organization/server quotas remain OPEN.
- Base subscription prices should be globally consistent; UI may show converted local currency.