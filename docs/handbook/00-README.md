# MTA NEXUS — Project Handbook

**Статус:** product/engineering specification / owner review rounds 1–9 incorporated  
**Срез:** 2026-10-06  
**Текущий репозиторий:** `acc-holo-dev/mta-nexus-site`  
**Наследуемый источник идей:** `acc-holo-dev/mta-market-platform`  
**Версия текущего репозитория на момент сбора:** `1.2.0-beta.3`

---

## Зачем существует этот комплект

Этот каталог собирает в одном месте продуктовый и технический замысел MTA NEXUS так, чтобы:

1. владелец проекта мог прочитать документацию как учебник и проверить, действительно ли она отражает его замысел;
2. новый разработчик мог быстро понять продукт без чтения всей истории чатов;
3. ИИ-агент мог продолжить разработку, не выдумывая бизнес-правила и не возвращая старые идеи как будто они уже одобрены;
4. продуктовые решения, архитектура и эксплуатационные ограничения не смешивались;
5. было понятно, что уже существует, что является обязательным принципом, что пришло из старого MTA Market, а что пока только идея.

## Статусы утверждений

В этих документах используются четыре основных статуса происхождения утверждений. В roadmap/decision register дополнительно применяются planning-метки `PROVISIONAL`, `CANDIDATE`, `BUSINESS GATE`, `LEGACY` и `REJECTED`.

- **CURRENT** — подтверждено текущим `mta-nexus-site`, его кодом, схемой БД, тестами или действующей документацией.
- **DECISION** — зафиксированное продуктовое или инженерное решение, которое новый агент должен сохранять, пока владелец проекта явно его не изменит.
- **LEGACY INTENT** — идея или механизм из `mta-market-platform`, полезный для понимания исходной большой концепции, но не являющийся автоматически утверждённой функцией MTA NEXUS.
- **OPEN** — решение ещё нужно принять с владельцем проекта.

Критическое правило: **LEGACY INTENT никогда не превращается в CURRENT только потому, что для него когда-то существовал код или документ.**

## Коротко: что такое MTA NEXUS

MTA NEXUS — **единая площадка для всего сообщества Multi Theft Auto: San Andreas**, которая объединяет равноправные продуктовые направления:

- живой каталог MTA-серверов;
- страницы и подтверждённое владение серверами;
- сообщество, публикации, комментарии и подписки;
- безопасное распространение MTA-ресурсов;
- профили пользователей и организаций;
- модерацию, жалобы, верификацию и аудит;
- marketplace бесплатных и платных ресурсов;
- подписки и разовые платные возможности для разных ролей;
- коммерческое лицензирование и обязательный DRM-контур для защищаемых платных ресурсов.

Главная идея — не «магазин скриптов», не «мониторинг серверов» и не «форум». **Servers, Resources, Community, Content, Marketplace, Trust и Identity должны быть равноправными частями одной экосистемы.** Ценность появляется из связей между ними и из того, что любой посетитель получает причину остаться и возвращаться.

## Эволюция проекта

### MTA Market

Старый `mta-market-platform` проектировался шире и агрессивнее как полноценная экосистема:

- SERVER как центральная сущность;
- marketplace бесплатных и платных ресурсов;
- Seller / Buyer flows;
- платежи, 10% комиссия, ledger, выплаты;
- лицензии и DRM;
- услуги и гарантийные сделки;
- форумы, статьи, новости, отзывы, reputation/trust.

Часть этих идей остаётся полезной продуктовой базой.

### MTA NEXUS

Текущий проект сознательно сузил первый релиз:

- live discovery MTA-серверов;
- account/session flows;
- server ownership и управление;
- community/content;
- follows и notifications;
- бесплатные ресурсы;
- строгая проверка и модерация сборок;
- RU/EN;
- closed beta;
- production-readiness и честная проверяемость действий.

**CURRENT:** closed beta пока не включает simulated paid checkout, пользовательские балансы, выплаты продавцам, криптовалютные расчёты или активный DRM-коммерческий контур.

**OWNER DECISION 2026-10-06:** это ограничение относится к текущему этапу, а не к финальной концепции. Целевой NEXUS включает платный marketplace, комиссию 10%, платные подписки и разовые функции. DRM capability обязательна для коммерческой архитектуры, но seller подключает её к конкретному продукту по желанию.

**OWNER DECISION — Round 4:** коммерческий фокус начинается с **MTA Scripts**. Seller сам назначает цену. Для продукта допустимы Free/Premium edition, bundles, coupons/discounts и две основные delivery-модели: closed code (seller может включить DRM) либо open source (DRM отсутствует). Покупка включает будущие обновления без отдельной платы; version history/changelog становится обязательной частью зрелого marketplace.

**OWNER DECISION — Round 5:** marketplace использует корзину; базовая commercial license — **1 license = 1 MTA server**. Trial/demo и wishlist входят в target. Seller задаёт срок support, а общая support-система принадлежит NEXUS. При добровольном delist или блокировке seller покупателям сохраняется окно доступа **30 дней**; malware/legal takedown может закрывать доступ раньше. Server claim сохраняет текущий MTA challenge, server может иметь нескольких co-owners и поддерживает audited ownership transfer. Public launch target — **Open Beta для всех**. Реальные платежи запрещено активировать до полного legal/provider/security/operations gate.

**OWNER DECISION — Round 6:** после login пользователь остаётся на Home; управление сосредоточено в едином адаптивном `/workspace`. Seller/Server/Organization dashboards получают полный role-relevant набор, Buyer Library — отдельные Purchased/Free/Trials/Licenses/Updates/Support/Invoices surfaces. Product page явно показывает delivery/source/DRM model, поддерживает rich media и dependency graph; compatibility metadata optional, automatic compatibility inference не требуется. Delisted paid product frozen, redownload window 30 дней, но уже активная DRM-license живёт до конца договорного оплаченного срока. Security Center, quarantine, malware outreach и global admin case search обязательны. Public profile открыт по умолчанию на безопасных полях; immutable User ID — primary identity, vanity username доступен как subscription capability; его смена — отдельная платная операция, а slug освобождается после окончания entitlement. Home конечная, Community Feed может быть infinite, `/discover` обязателен. API/webhooks — не launch blocker; при появлении API сначала authenticated partners/Pro, а не anonymous public API.

**OWNER DECISION — Round 7:** public surfaces полностью читаются гостем, но действия требуют аккаунта и подтверждённого email. Основной login — email/password; social accounts используются как verified external identities, а не как OAuth-login. Account deletion автоматически архивирует personal-owned сущности, сохраняя обязательные audit/legal/financial records. Vanity username живёт вместе с paid entitlement; после его окончания действует 7-дневный reservation grace, затем slug освобождается; смена username — отдельная покупка. Guest cart разрешена, binding commercial license выполняется после покупки, но unbound paid license должна быть активирована в течение 30 дней. Publish wizard, KYC-before-first-payout, risk-aware auto-publish, archived product pages, organization permission templates, moderation timeline/queues, PWA, Web Push, themes, WCAG 2.2 AA и user Activity & Security Log входят в target release/product spec. Telegram/Discord bots отложены; основной outbound channel на этом этапе — email, плюс in-app/Web Push.

**OWNER DECISION — Round 8:** Home starts with global search/ecosystem state and includes `Trending now`; guest cards use contextual CTAs. `/discover` is cross-ecosystem but deliberately **does not** use one mixed heterogeneous feed: Servers/Resources/People/Organizations/Content/Events have separate sections/tabs and filters. Profile Activity is a public timeline; a dedicated public Trust/Reputation tab is confirmed and shows evidence rather than a single score. Buyer, Seller, Server Owner, Organization and Staff screens are now specified. Server teams reuse the Organization capability engine. `/pricing` transparently compares plan families and economic effects. Vanity username has a 7-day post-entitlement reservation grace. PWA offline mode blocks sensitive writes and production errors show only support-safe correlation IDs.

**OWNER DECISION — Round 9:** marketplace commission remains **10% for everyone at the current baseline**, while future Creator plans may reduce that percentage. New-seller payout hold starts at 7 days and may be shortened through subscription, verification and strong history. `Creator Free` remains viable with manual moderation; paid Creator capabilities may provide auto-publish/advanced analytics/automation, and one-off paid accelerated publication is allowed without bypassing security gates. `Server Pro` may use multiple tiers plus one-time purchases; `Organization Pro` is billed per organization; `NEXUS Pro` is the maximal cross-ecosystem bundle. Base plan prices are globally consistent, with local currency display/conversion rather than hidden regional pricing.

Trust is evidence-based and now has a dedicated public profile tab. Exact successful sales/deals counts may be shown. Finalized moderation history remains visible as historical trust context, with private evidence and sensitive details redacted. First forum topics and low-trust articles/guides use premoderation; healthy history may move content to post-moderation. Paid advertising always passes content-policy review. Claimed-server news/devlogs may publish immediately without active risk flags. Trust can relax quotas but never creates unlimited bypasses.

Marketplace licenses may be perpetual or time-limited. A perpetual DRM license remains valid indefinitely after activation unless formally revoked for an allowed reason or affected by malware/legal/security action; the 7-day period is the offline lease grace, not the license lifetime. Seller-opt-in forensic watermarking is confirmed as an evidence layer without per-customer runtime recompilation and never causes automatic ban from one signal. Production commercial artifacts target private object storage with signed CDN delivery; ClamAV remains the baseline scanner behind a pluggable multi-scanner architecture. Payment providers remain provider-agnostic until the production legal/provider gate. The exact production observability vendor/delegation policy remains OPEN because the owner has not yet approved Round 9 question 30.

## Основные продуктовые принципы

1. **Ecosystem first.** Все посетители — игроки, владельцы серверов, разработчики, покупатели, авторы и участники community — являются полноценной аудиторией; ни один pillar не должен поглощать остальные.
2. **Real data only.** Никаких выдуманных online, продаж, рейтингов, «успехов» или функций-заглушек, выглядящих рабочими.
3. **Trust by design.** Доверие строится техническими доказательствами и прозрачными состояниями, а не бейджем ради бейджа.
4. **Privacy by default.** Не раскрывать данные сервера, пользователя, организации, покупателя или внутренней инфраструктуры без необходимости и явной политики.
5. **Server-authoritative UI.** Интерфейс показывает успех только после подтверждённого сервером результата.
6. **Safe resources by default.** Публично скачивается только опубликованная сборка с валидным clean scan и provenance.
7. **One ecosystem.** Серверы, ресурсы, пользователи, организации, статьи, уведомления и модерация должны ощущаться частями одного продукта.
8. **Invisible complexity.** Сложные проверки, транзакции и безопасность не должны превращать обычное действие пользователя в технический квест.
9. **RU/EN are first-class.** Русский и английский интерфейсы развиваются как один продукт, а не основной язык плюс поздний перевод.
10. **Scale after evidence.** До реальной нагрузки — модульный монолит, PostgreSQL и один экземпляр приложения; без преждевременного Redis/Kafka/Kubernetes/microservices.

## Карта учебника

1. [`01-PROJECT-CONCEPT.md`](01-PROJECT-CONCEPT.md) — миссия, целевая аудитория, ценность, уникальность и ecosystem loops.
2. [`02-ROLES-AND-PERMISSIONS.md`](02-ROLES-AND-PERMISSIONS.md) — гость, пользователь, автор, владелец сервера, организация, модератор, админ, будущий Seller/Buyer.
3. [`03-FEATURES-AND-SURFACES.md`](03-FEATURES-AND-SURFACES.md) — что умеет сайт и какие пользовательские поверхности существуют.
4. [`04-TRUST-SAFETY-SECURITY.md`](04-TRUST-SAFETY-SECURITY.md) — защита, trust layer, сканирование, storage integrity, moderation, privacy.
5. [`05-UX-AND-DESIGN.md`](05-UX-AND-DESIGN.md) — UX, RU/EN, mobile/desktop, accessibility, состояние ошибок и доверие через интерфейс.
6. [`06-BUSINESS-MODEL.md`](06-BUSINESS-MODEL.md) — текущая free beta, подтверждённая 10% marketplace commission, подписки/разовые покупки, seller model и DRM-направление.
7. [`07-TECHNICAL-ARCHITECTURE.md`](07-TECHNICAL-ARCHITECTURE.md) — стек, модульный монолит, пакеты, инфраструктура и технические границы.
8. [`08-DOMAIN-AND-DATA-MODEL.md`](08-DOMAIN-AND-DATA-MODEL.md) — сущности, связи, состояния и инварианты данных.
9. [`09-OPERATIONS-TESTING-RELEASE.md`](09-OPERATIONS-TESTING-RELEASE.md) — dev, CI, тестирование, production gates, backup/restore и миграции.
10. [`10-ROADMAP.md`](10-ROADMAP.md) — дальнейшее развитие с чётким разделением committed и candidate направлений.
11. [`11-AI-AGENT-HANDOFF.md`](11-AI-AGENT-HANDOFF.md) — инструкция следующему ИИ-агенту.
12. [`12-INTERVIEW-QUESTIONS.md`](12-INTERVIEW-QUESTIONS.md) — вопросы владельцу проекта для превращения этого draft в финальную продуктовую спецификацию.
13. [`13-DECISION-REGISTER.md`](13-DECISION-REGISTER.md) — известные решения и открытые продуктовые развилки.
14. [`14-SOURCE-MAP.md`](14-SOURCE-MAP.md) — откуда взята информация и какой источник сильнее при конфликте.
15. [`15-AI-CONTEXT-INDEX.md`](15-AI-CONTEXT-INDEX.md) — короткий маршрут чтения для AI-агента и критические stop-gates.
16. [`16-DOCUMENTATION-INTEGRATION-PLAN.md`](16-DOCUMENTATION-INTEGRATION-PLAN.md) — как после ревью перенести handbook в GitHub, не сломав текущую docs policy.
17. [`17-DRM-AND-LICENSING.md`](17-DRM-AND-LICENSING.md) — target DRM/license architecture и universal runtime.
18. [`18-COMMERCE-AND-PAYOUT-FLOWS.md`](18-COMMERCE-AND-PAYOUT-FLOWS.md) — payments, payouts, subscriptions и disputes.
19. [`19-COMMUNITY-AND-RETENTION.md`](19-COMMUNITY-AND-RETENTION.md) — forum/content/feed/events и moderation modes.
20. [`20-ADMIN-MODERATION-AND-APPEALS.md`](20-ADMIN-MODERATION-AND-APPEALS.md) — специализированные staff-отделы, санкции, SCAM/blacklist, прозрачность и апелляции.
21. [`21-REPUTATION-VERIFICATION-AND-REVIEWS.md`](21-REPUTATION-VERIFICATION-AND-REVIEWS.md) — evidence-based verification, reputation signals и verified reviews.
22. [`22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md`](22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md) — pillar plans, NEXUS bundle, сроки подписок, реклама и one-time inventory.
23. [`23-MARKETPLACE-PRODUCT-LIFECYCLE.md`](23-MARKETPLACE-PRODUCT-LIFECYCLE.md) — MTA Scripts, editions/SKUs, pricing, publication, purchase, delivery, updates, refunds и seller analytics.
24. [`24-SERVERS-ORGANIZATIONS-AND-PROFILES.md`](24-SERVERS-ORGANIZATIONS-AND-PROFILES.md) — claimed server experience, teams, recruitment, organizations, profile privacy и promotion.
25. [`25-DEALS-SERVICES-AND-GUARANTEE.md`](25-DEALS-SERVICES-AND-GUARANTEE.md) — услуги/custom development, Deal lifecycle, protected funding, delivery, disputes и settlement boundaries.
26. [`26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md`](26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md) — ranking signals, filters, sponsored inventory и opt-out personalization.
27. [`27-MESSAGING-GROUPS-AND-SOCIAL-SYSTEMS.md`](27-MESSAGING-GROUPS-AND-SOCIAL-SYSTEMS.md) — DMs, clans/groups, community authoring, events, achievements и notification surfaces.
28. [`28-CART-LICENSES-AND-ACCESS-RIGHTS.md`](28-CART-LICENSES-AND-ACCESS-RIGHTS.md) — cart/order composition, single-server licensing, 30-day delist/ban access window и entitlement termination rules.
29. [`29-SUPPORT-TRIAL-WISHLIST-AND-BILLING-UX.md`](29-SUPPORT-TRIAL-WISHLIST-AND-BILLING-UX.md) — trials, wishlist, unified support, seller balance, localized pricing и receipts.
30. [`30-SERVER-OWNERSHIP-STATUS-AND-JOIN.md`](30-SERVER-OWNERSHIP-STATUS-AND-JOIN.md) — MTA challenge claim, co-owners, transfer, incidents/status/events и Join Server.
31. [`31-ORGANIZATION-COMMERCE-AND-MESSAGING-POLICY.md`](31-ORGANIZATION-COMMERCE-AND-MESSAGING-POLICY.md) — organization billing/payout ownership, DM request policy, block/private groups и no voice/video.
32. [`32-LAUNCH-ONBOARDING-AND-PRODUCTION-GATES.md`](32-LAUNCH-ONBOARDING-AND-PRODUCTION-GATES.md) — shared home, onboarding, Open Beta и mandatory real-payment production gates.
33. [`33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md`](33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md) — единый multi-role Workspace, seller/server/org dashboards, Buyer Library и purchase detail.
34. [`34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md`](34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md) — product page, media, optional compatibility, dependency graph, delist freeze и DRM/access semantics.
35. [`35-SECURITY-CENTER-QUARANTINE-ADMIN-AND-API.md`](35-SECURITY-CENTER-QUARANTINE-ADMIN-AND-API.md) — Security Center, admin case search, quarantine, malware response, provider raw-data boundaries и API policy.
36. [`36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md`](36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md) — immutable ID, public profiles, entitlement-bound vanity username и verified external links.
37. [`37-HOME-DISCOVER-NAVIGATION-AND-FEEDS.md`](37-HOME-DISCOVER-NAVIGATION-AND-FEEDS.md) — Home, Discover, Community Feed, top-level navigation и no-command UX.
38. [`38-ACCOUNT-AUTH-AND-LIFECYCLE.md`](38-ACCOUNT-AUTH-AND-LIFECYCLE.md) — guest/auth/email verification, account archive/delete semantics и identity lifecycle.
39. [`39-SELLER-PUBLISHING-KYC-AND-CATALOG-STATES.md`](39-SELLER-PUBLISHING-KYC-AND-CATALOG-STATES.md) — seller publishing, KYC, auto-publish risk rules и catalog states.
40. [`40-STAFF-CASEWORK-GOVERNANCE-AND-QUEUES.md`](40-STAFF-CASEWORK-GOVERNANCE-AND-QUEUES.md) — case timeline, staff notes, queues/escalation и governance.
41. [`41-PWA-THEMES-ACCESSIBILITY-AND-NOTIFICATIONS.md`](41-PWA-THEMES-ACCESSIBILITY-AND-NOTIFICATIONS.md) — PWA, Web Push, themes, WCAG 2.2 AA и notification policy.
42. [`42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md`](42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md) — analytics boundaries, privacy, retention classes и user activity/security log.
43. [`43-ROLE-SURFACE-MAP.md`](43-ROLE-SURFACE-MAP.md) — role-to-surface map and separation of capabilities.
44. [`44-GUEST-HOME-DISCOVER-SCREENS.md`](44-GUEST-HOME-DISCOVER-SCREENS.md) — Home, Trending, contextual guest CTA and non-mixed Discover.
45. [`45-USER-PROFILE-COMMUNITY-SCREENS.md`](45-USER-PROFILE-COMMUNITY-SCREENS.md) — public profile/activity/community screens and Trust-tab OPEN item.
46. [`46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md`](46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md) — cart, checkout, purchase tabs, activation reminders and library.
47. [`47-SELLER-CREATOR-SCREENS.md`](47-SELLER-CREATOR-SCREENS.md) — seller KPI, products, publish, analytics, promotions and support.
48. [`48-SERVER-OWNER-SCREENS.md`](48-SERVER-OWNER-SCREENS.md) — server dashboard, page builder, recruitment and shared capability model.
49. [`49-ORGANIZATION-SCREENS.md`](49-ORGANIZATION-SCREENS.md) — organization context, finance, storefront, permissions and invites.
50. [`50-STAFF-OPERATIONS-SCREENS.md`](50-STAFF-OPERATIONS-SCREENS.md) — staff queues, casework, impact preview and System tools.
51. [`51-PRICING-SUBSCRIPTIONS-ERROR-OFFLINE-UX.md`](51-PRICING-SUBSCRIPTIONS-ERROR-OFFLINE-UX.md) — pricing transparency, expiry, offline PWA and production error UX.

## Порядок чтения для человека

`00 → 01 → 02 → 03 → 04 → 05 → 06 → 10`

После этого — технические главы `07 → 08 → 09`.

## Порядок чтения для ИИ-агента

`15 → 00 → 13 → 11 → 07 → 08 → 09 → 10`.

Перед любым крупным изменением агент обязан проверить текущий `main`, `docs/PROBLEMS.md`, `docs/ARCHITECTURE.md` и `docs/OPERATIONS.md` в `mta-nexus-site`.


## Важно перед переносом в `mta-nexus-site/docs`

Текущий репозиторий сознательно поддерживает только три long-form документа (`ARCHITECTURE.md`, `OPERATIONS.md`, `PROBLEMS.md`), а состав документации контролируется repository-policy тестом. Этот handbook пока является **review bundle**, а не готовой заменой текущего `docs/`.

После утверждения владельцем нужен отдельный documentation migration:

1. решить, оставить handbook набором файлов или консолидировать его;
2. определить каноническое место в репозитории;
3. изменить README/documentation policy намеренно;
4. изменить соответствующий policy test;
5. устранить дублирование с текущими `ARCHITECTURE/OPERATIONS/PROBLEMS`;
6. только после этого коммитить итоговую структуру в `main`.

Это предотвращает ситуацию, когда полезная документация сама ломает CI или создаёт два конкурирующих источника истины.

## Что этот draft пока не решает

После восьми owner-review уже подтверждены позиционирование, равноправие pillars, all-master-list server discovery, paid marketplace, 10% комиссия, Server Pro, sponsored placement, subscription-only auto-publish, широкая payment architecture, обязательные disputes, 7-day DRM grace и hard-stop, universal DRM runtime, большой community scope, специализированная staff-модель, апелляции, public sanctions/blacklist, evidence-based reputation, flexible subscriptions и высокая автономия AI-агента.

Открыты более конкретные вопросы:

- конкретные launch payment providers, currencies, jurisdiction и merchant/tax model;
- refund rules, payout reserve/intervals и chargeback policy;
- точные цены каждого subscription tier и конкретный launch inventory рекламы/публикационных one-time услуг;
- формальные thresholds/SLAs для verification, appeals, sanctions и staff escalation;
- forensic watermark/fingerprinting policy для DRM и утечек;
- launch payment providers/currencies/jurisdictions, tax/VAT и seller onboarding/KYC model;
- homepage/search/profile/community UX details;
- критерии выхода из beta и production hosting.

Они продолжают собираться в `12-INTERVIEW-QUESTIONS.md` и `13-DECISION-REGISTER.md`.

52. [`52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md`](52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md) — baseline 10% commission, Creator/Server/Organization/NEXUS plan semantics, payout hold and one-off monetization.
53. [`53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md`](53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md) — public Trust tab, moderation history, pre/post-moderation matrix and reputation-dependent quotas.
54. [`54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md`](54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md) — perpetual/time-limited licensing, DRM lifetime, forensic watermark and controlled revocation.
55. [`55-PRODUCTION-STORAGE-SCANNERS-AND-OBSERVABILITY.md`](55-PRODUCTION-STORAGE-SCANNERS-AND-OBSERVABILITY.md) — provider-agnostic payments, private object storage/CDN, scanner adapters and remaining observability decision.
56. [`56-SUPPORT-SLA-AND-DISPUTE-TIMING.md`](56-SUPPORT-SLA-AND-DISPUTE-TIMING.md) — support commitments, seller support periods, priority rules and dispute target timing.