# MTA NEXUS — roadmap и развитие продукта

> Статус: проектный roadmap v0.2 — owner review round 1 incorporated.  
> Важно: этот файл разделяет обязательные работы, сильные кандидаты и старые идеи. Наличие идеи здесь не означает автоматическую реализацию.

## 1. Как читать roadmap

Используются четыре статуса:

- **COMMITTED** — логически следует из текущего closed-beta/release курса;
- **CANDIDATE** — сильная идея, требует product selection;
- **BUSINESS GATE** — нельзя начинать до решения о коммерческой модели;
- **CONFIRMED TARGET** — стратегическое направление уже утверждено владельцем, но ещё может не быть реализовано.

## Owner-confirmed strategic direction

`Servers + Resources + Community + Content + Marketplace + Trust + Identity` — единая равноправная система. Marketplace, subscriptions/one-time paid features и DRM являются подтверждённой целевой частью продукта, а не опциональным legacy-наследием.

---

## 2. North Star разработки

Ближайшая цель:

> Довести MTA NEXUS от качественного closed-beta codebase до понятного, надёжного и реально запускаемого продукта, прежде чем резко расширять scope.

Это означает:

1. закрыть реальные acceptance gaps;
2. довести UX/RU/EN;
3. проверить release/recovery на target-like infrastructure;
4. стабилизировать основные loops;
5. только затем открывать платную коммерцию или тяжёлую новую инфраструктуру.

---

## 3. Phase 0 — Product direction freeze

### PARTIALLY COMPLETED / COMMITTED

Первый owner interview уже зафиксировал стратегический каркас:

- позиционирование: единая площадка всего MTA community;
- аудитория: все посетители сайта;
- pillars равноправны;
- paid marketplace нужен;
- platform commission = 10%;
- paid subscriptions + one-time monetization нужны;
- seller application не является обязательным gate;
- community должен быть большим;
- DRM capability обязательна для платформы; seller opt-in per product;
- AI имеет широкую development autonomy.

Перед production commerce всё ещё нужно уточнить:

- географию/юридическую модель запуска;
- currencies/payment providers;
- payout/refund/chargeback details и launch provider set;
- точные subscription tiers/prices;
- staff/moderation/reputation policies;
- DRM binding/offline/module model.

### Почему это важно

Теперь AI не должен заново спорить о том, нужен ли marketplace или DRM. Его задача — последовательно строить подтверждённую модель, сохраняя current closed-beta safety и отдельный human gate для реального production money flow.

---

## 4. Phase 1 — Closed beta completion

### COMMITTED

Цель — получить версию, которую можно уверенно дать ограниченной группе реальных пользователей.

Работы:

- устранить/сократить актуальные lint warnings;
- пройти remaining target-infrastructure checks;
- проверить query plans и representative target DB;
- проверить disk/memory/latency critical paths;
- проверить browser/device download behavior;
- проверить external MTA source degradation;
- убедиться в корректной production mail/recovery конфигурации;
- закрыть host toolchain mismatch в рабочем окружении;
- очистить test/dev hygiene, где это влияет на воспроизводимость;
- пройти backup/restore rehearsal;
- сформировать exact-SHA release evidence.

### Acceptance

- no P0;
- release-impacting P1 закрыты или accepted;
- clean target-like restore rehearsal;
- critical RU/EN browser journeys;
- documented production decision.

---

## 5. Phase 2 — Product Experience / UI pass

### COMMITTED / CANDIDATE mix

Цель — чтобы NEXUS воспринимался как цельный продукт, а не набор рабочих страниц.

Приоритеты:

- единый visual language;
- home как полезный вход в экосистему;
- более понятный server discovery;
- resource discovery + detail trust presentation;
- creator/developer profile;
- coherent workspace;
- понятная moderation surface;
- empty/loading/error states;
- RU/EN полнота;
- mobile polish;
- accessibility audit;
- performance budgets.

### Не делать

Не маскировать отсутствующую функциональность красивыми mock controls.

---

## 6. Phase 3 — Server intelligence

### CANDIDATE

Один из наиболее естественных способов сделать NEXUS уникальным без платежей.

Возможности:

- historical observation timeline;
- online/player trend charts;
- last-seen changes;
- server watchlist;
- follow + meaningful change notifications;
- «что изменилось у сервера»;
- tags/modes/search intelligence;
- reliability/observation confidence.

### Product value

Игрок получает не просто список серверов, а инструмент понимания живой MTA-экосистемы.

### Guardrails

- only public/consented data;
- no invasive player tracking;
- gaps/stale data clearly labeled;
- no fake uptime precision.

---

## 7. Phase 4 — Resource intelligence

### CANDIDATE

Цель — превратить каталог файлов в trusted developer ecosystem.

Возможности:

- Resource Inspector;
- manifest/meta.xml summary;
- declared ACL/export preview;
- MTA version compatibility;
- dependency relationships;
- changelog/history;
- provenance;
- author verification;
- build integrity history;
- safe badges with exact semantics;
- compatibility matrix.

### Уникальность

Пользователь видит не только «скачать ZIP», а понятную техническую карточку ресурса и доказательства его происхождения/проверки.

---

## 8. Phase 5 — GitHub / developer workflow

### CANDIDATE

Из прошлых обсуждений сильная идея — сделать публикацию удобной разработчикам.

Варианты:

- import metadata from GitHub;
- link repository to resource;
- release synchronization;
- changelog/release notes ingestion;
- verified repository ownership;
- optional webhook/update automation;
- dependency metadata.

### Guardrail

NEXUS не должен автоматически доверять содержимому GitHub release. Artifact всё равно проходит собственный safety pipeline.

---

## 9. Phase 6 — Community/content strengthening

### CONFIRMED TARGET

Возможные surfaces:

- global forum;
- server/resource discussions;
- articles/guides;
- server news/updates;
- creator devlogs;
- curated collections;
- activity feed;
- follow-based personalized dashboard;
- events/contests;
- direct messages by first commercial version.

Некоторые content types используют pre-moderation; exact matrix остаётся policy work.

### Principle

Не строить generic social network.

Community нужна для:

- discovery;
- knowledge;
- support;
- reputation;
- server/resource lifecycle.

---

## 10. Phase 7 — Trust platform

### CANDIDATE

Развитие уже существующих verification/moderation primitives:

- explicit verification types;
- evidence-backed badges;
- verified interaction reviews;
- creator/server trust history;
- moderation transparency;
- artifact provenance;
- abuse/risk signals;
- public status/trust explanations.

### Не делать

- универсальный «trust score» без объяснимости;
- продавать verified badge;
- публиковать обвинения без evidence/moderation;
- выдавать antivirus scan за гарантию полной безопасности.

---

## 11. Phase 8 — Paid marketplace foundation

### CONFIRMED TARGET / IMPLEMENTATION GATE

Paid marketplace утверждён как направление. Начинать production activation можно только после проработки legal/provider/refund/payout требований; разработку foundation можно вести по roadmap.

Последовательность должна быть консервативной:

1. утвердить seller policy;
2. утвердить legal/region/currency/tax/refund model;
3. выбрать payment provider(s);
4. восстановить/перепроверить Order/Purchase/Payment semantics;
5. сделать paid checkout sandbox;
6. webhook verification/idempotency;
7. license/entitlement issuance;
8. refund behavior;
9. dispute basics;
10. только затем production payments.

### Legacy reference

OWNER DECISION: базовая platform fee — **10%**. Точная база расчёта (gross/final, PSP fee, taxes/refunds) должна быть специфицирована до production.

---

## 12. Phase 9 — Seller economy

### CONFIRMED TARGET

После working paid checkout:

- seller onboarding;
- storefront;
- seller analytics;
- commission ledger;
- payout eligibility;
- payout reconciliation;
- refund/chargeback reserve;
- fraud/risk controls;
- seller suspension policy.

### Principle

Если seller balance показывает деньги, платформа должна уметь объяснить:

- откуда сумма;
- что доступно к выплате;
- что pending;
- что удержано;
- что refund/dispute affected.

---

## 13. Phase 10 — Subscriptions / Pro

### CONFIRMED TARGET

Подписки и разовые платные возможности подтверждены как часть стратегии. Конкретные планы должны появляться там, где есть понятная ценность и измеримый спрос.

Основные варианты:

### Creator Pro

CONFIRMED DIRECTION:

- advanced analytics;
- storefront customization;
- larger media limits;
- automation/webhooks;
- team tools;
- release workflow enhancements;
- subscription-only auto-publish after mandatory automated safety/policy gates.

### Server Pro

OWNER DECISION: допустим полный набор:

- deeper historical analytics;
- advanced page customization;
- alerting;
- webhooks/API;
- richer monitoring retention;
- page/media customization;
- team tools;
- automation;
- promotion inventory.

### Free user

Free tier должен оставаться полезным входом в ecosystem. При этом owner не установил список «навсегда бесплатных» бизнес-функций. Нельзя лишь продавать ложные trust/safety claims или позволять оплатой обходить обязательную техническую безопасность без отдельного явного решения.

---

## 14. Phase 11 — Services / Guarantee / Deals

### LEGACY IDEA / BUSINESS GATE

Это отдельный marketplace class, не расширение обычного resource checkout.

Потребуются:

- deal state machine;
- funding/legal provider;
- delivery evidence;
- buyer verification;
- dispute;
- settlement/refund;
- moderation tooling;
- privacy.

Не начинать до зрелой обычной коммерции.

---

## 15. Phase 12 — DRM / protected distribution

### CONFIRMED TARGET / DESIGN GATE

DRM capability обязателен как часть целевой коммерческой системы, но seller включает её опционально для конкретного продукта. Protected flow строится поверх устойчивых purchase/license primitives.

Possible scope:

- `Purchase → License → Installation/Server → Activation → Lease`;
- server/installation binding;
- signed challenge/lease;
- 7-day offline grace;
- universal compiled runtime/module reusable across many servers without per-customer recompilation;
- controlled update delivery;
- revocation;
- optional encrypted artifacts;
- forensic attribution.

### Honest product claim

DRM снижает удобство массового копирования/пиратства, но не делает Lua/C++/resource абсолютно невзламываемым.

---

## 16. Phase 13 — External platform/API

### CANDIDATE, LATER

- public API;
- API keys;
- webhooks;
- bot integrations;
- server/creator widgets;
- ecosystem analytics exports.

### Gate

Сначала internal authorization/rate-limit/audit semantics должны быть стабильны.

---

## 17. Phase 14 — Scale

### LATER

Только по реальным данным:

- object storage + CDN;
- background job queue;
- distributed cache;
- search engine;
- read replicas;
- multiple app instances;
- dedicated analytics pipeline.

Не строить заранее.

---

## 18. Product maturity model

Полезная legacy-модель, адаптированная для NEXUS:

```text
Level 1  Working Product
Level 2  Trusted Closed Beta
Level 3  Product Experience
Level 4  Community + Server Intelligence
Level 5  Resource/Creator Ecosystem
Level 6  Paid Marketplace
Level 7  Trust/Transaction Platform
Level 8  Integrated MTA Ecosystem
```

Это не календарный график и не обещание реализовать каждый Level.

---

## 19. Что развивать параллельно

Некоторые треки можно вести независимо:

### Reliability track

- security;
- tests;
- performance;
- operations;
- release.

### Product track

- UI/UX;
- server intelligence;
- resource intelligence;
- community.

### Business design track

- pricing;
- seller policy;
- payment/legal;
- subscriptions.

### Documentation/AI track

- handbook;
- decision register;
- source of truth;
- agent handoff.

---

## 20. Anti-scope-creep rules

1. Идея из legacy docs не становится задачей автоматически.
2. Новый paid feature не включается до business decision.
3. Новый infrastructure component требует measured need.
4. Новый badge требует evidence semantics.
5. Новый public metric требует real data source.
6. Новая user role не создаётся, если capability/permission достаточно.
7. Новая документация не должна дублировать живой source of truth без причины.
8. Каждая крупная фаза должна усиливать конкретный user loop.

---

## 21. Предпочтительный порядок ближайших работ

OWNER DECISION: владелец не требует product-priority между Community, Marketplace, Server и DRM tracks; важен законченный результат. Порядок ниже — engineering dependency recommendation. Агент может вести несколько tracks параллельно, если сохраняет acceptance gates и завершает coherent slices.

### COMMITTED RECOMMENDATION

```text
1. Зафиксировать ответы владельца на вопросы handbook
2. Закрыть current release/infra gaps
3. UI/UX + RU/EN polish
4. Closed beta release
5. Server Intelligence
6. Resource Intelligence / creator workflow
7. Community/content improvements
8. Спроектировать paid marketplace foundation (10% commission)
9. Реализовать payments/seller economy/subscriptions поэтапно
10. Встроить обязательный DRM поверх стабильной license/entitlement модели
```

Этот порядок минимизирует риск построить сложную финансовую систему до того, как доказана полезность ядра NEXUS.

---

## 22. Границы автономии AI-агента

OWNER DECISION: AI может самостоятельно выбирать следующую development-задачу, исправлять bugs, рефакторить, менять архитектуру при необходимости, добавлять небольшие и крупные связанные features, dependencies, migrations, CI и коммитить/пушить в `main`.

Отдельного human gate по-прежнему требуют:

- production deployment/traffic switch;
- destructive production data operations;
- необратимые migrations;
- реальные payment credentials и production payment activation;
- изменение уже согласованной 10% комиссии или другой financial/legal модели;
- payout/escrow/guarantee legal activation;
- изменения privacy/retention, раскрывающие ранее private data;
- действия с высоким риском необратимой потери данных/ключей.

AI **не обязан** спрашивать разрешение просто для разработки marketplace/subscription/DRM foundation, если она следует этому handbook и остаётся безопасно выключенной до соответствующего production gate.

---

## 23. Roadmap metrics

### Closed beta

- successful registration/login/recovery rate;
- server directory freshness/error rate;
- safe resource publication success;
- claim/download success;
- moderation turnaround;
- crash/error rate;
- returning active users.

### Ecosystem later

- weekly meaningful participants;
- active servers;
- active creators;
- published resources;
- repeat visits;
- follows leading to return;
- verified interactions;
- moderation/report rate.

### Marketplace later

- GMV;
- platform revenue;
- seller activation;
- buyer repeat rate;
- refund/chargeback/dispute rate;
- payout reliability.

---

## 24. Roadmap review rule

После каждой крупной phase:

1. сравнить actual product с handbook;
2. удалить устаревшие assumptions;
3. обновить Decision Register;
4. обновить Problems;
5. выбрать следующую phase по user/business evidence, а не по количеству красивых идей.



## 25. Round 3 implementation tracks

Owner does not require a fixed product-track order; engineering should choose dependency/risk-driven sequencing. Add these coherent tracks:

### Track A — Admin operating model
- staff capability schema;
- specialized admin sections/queues;
- case/evidence model;
- graduated/capability sanctions;
- public reasons + controlled SCAM/blacklist;
- appeals;
- audit/step-up auth.

### Track B — Reputation and verification
- review eligibility based on purchase/claim interaction;
- review edit/version context;
- reputation signal model;
- verification evidence definitions;
- revocation/appeals.

### Track C — Subscription/ads foundation
- generic term entitlement (7d..1y);
- pillar plan + bundle representation;
- fixed-price placement inventory;
- Creator/Server/Organization entitlements;
- subscription-only auto-publish capability;
- no trust/security bypass.

### Track D — Community ownership
- server/org managed spaces;
- local moderator capabilities;
- pre/post moderation matrix;
- progressive new-account anti-abuse;
- multi-channel notification adapters.

### Track E — Commerce/DRM completion
- refund reason/dispute authority;
- source-code SKUs/licenses;
- license transfer cooldown/support path;
- 7-day grace + hard stop;
- minimal telemetry contract.

## Round 4 — confirmed target additions

Следующие направления теперь не `OPEN` по существованию, а confirmed target:

1. **MTA Scripts marketplace v1** — product/SKU, price, free/premium, bundles, discounts, purchase/payment/license separation, changelog/history, free future updates.
2. **Seller commercial operations** — analytics, 7-day base hold, 10% post-discount commission, audited refunds, Seller Agreement.
3. **Claimed server platform** — rich pages, public teams, recruitment/factions/applications/events, hybrid trust ranking.
4. **Universal Organizations** — multi-membership, granular permissions, billing owner, ownership transfer, audit.
5. **DM + social systems** — direct messages by first commercial release, groups/clans, rich forum/editor, achievements/events.
6. **Discovery layer** — global search, multi-signal ranking, fixed-price clearly labeled sponsored slots, personalization + full opt-out.
7. **Services + Deal/Guarantee** — custom development with protected funding and disputes.
8. **Transparency** — aggregate enforcement/dispute/security reporting.

Implementation ordering remains delegated to AI based on dependencies and ability to ship coherent completed slices. Commerce production activation remains a human/legal/provider gate.

## Round 5 — confirmed target additions

1. **Cart commerce** — multi-item cart, server-authoritative validation, per-item order/purchase/license lifecycle.
2. **Single-server licensing** — one commercial license per MTA server as default model.
3. **Buyer access policy** — 30-day post-delist/post-seller-ban download window; explicit security/legal exceptions.
4. **Trial + Wishlist + Support** — seller-enabled trial, wishlist notifications, unified NEXUS support with seller-defined support term.
5. **Billing UX** — local approximate price, provider tax/VAT where possible, seller settlement/balance view, receipts/invoices.
6. **Server ownership** — keep MTA challenge, add co-owners, audited transfer, operational incident/status posts and Join Server.
7. **Organization commerce** — org billing profile, seller ownership and provider-supported payout capability.
8. **Messaging safety** — message requests for strangers, block primitive, private groups; no in-product voice/video.
9. **Home/onboarding** — one home architecture with personalized modules after login; onboarding wizard; no command palette target.
10. **Open Beta** — first true public target is open for everyone, not staged invite-only launch.
11. **Production payment gate** — legal/provider/contracts/policies/tax/accounting/backup/security/incident/real settlement acceptance before activation.

### Mandatory warning for implementation order

Open Beta does **not** mean real payments must be enabled on day one. Public community/server/free-resource surfaces may open while commerce remains feature-gated until the complete payment production checklist passes.

## 25. Round 6 scope clarifications

### Commercial/public UX before optional developer platform

Prioritize coherent user-facing flows: unified Workspace, Buyer Library, purchase detail, product delivery/source/DRM clarity, Security Center, quarantine/malware incident response, public profile identity and Discover.

### API timing

Self-service API keys/webhooks are **not a commercial-launch blocker**. Existing ideas about Server/Creator/Organization Pro APIs remain future value. When an external contract ships, begin with authenticated partners/Pro before considering anonymous public read-only access.

### Operations

A separate public Status Page is not required. This does not lower the production requirement for internal logs, metrics, error tracking, uptime monitoring, alerting and incident response.

### Compatibility

Build dependency relations before speculative automatic compatibility intelligence. Compatibility metadata is optional; do not block publishing merely because seller did not fill a full matrix.


## Round 9 roadmap sync

The following are no longer discovery questions and should be treated as target product requirements:

- Creator Free + paid Creator automation/analytics model;
- commission-reduction capability for future Creator plans while baseline stays 10%;
- risk/trust-aware payout hold reduction from 7-day baseline;
- public Trust/Reputation tab and historical moderation state;
- trust-tiered content pre/post-moderation;
- perpetual + time-limited resource licensing;
- seller-opt-in forensic watermark evidence;
- production private object storage + signed delivery;
- pluggable malware/reputation scanners.

Still gated close to production: exact plan numbers, jurisdiction/legal/PSP contracts, retention durations and concrete infrastructure/observability vendors.