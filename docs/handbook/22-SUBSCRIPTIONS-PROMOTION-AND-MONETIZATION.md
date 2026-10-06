# 22. Subscriptions, promotion и monetization inventory

> Статус: OWNER DECISIONS rounds 1–4 + target design. Prices and exact launch SKUs remain OPEN.

## 1. Monetization philosophy

NEXUS can monetize broadly where it creates real value, while keeping trust/safety facts non-purchasable. Revenue sources include marketplace commission, subscriptions, fixed-price promotion and selected one-time operational/publishing services.

## 2. Plan topology

**DECISION:** both approaches are allowed simultaneously:

- specialized plans per pillar: Creator/Developer, Server, Organization and future role-specific plans;
- umbrella bundle such as `NEXUS Pro`, combining benefits across pillars.

Plans can have different tier ladders. Do not force every pillar into identical `Free/Pro/Business` semantics if the value differs.

## 3. Subscription terms

**DECISION:** entitlement duration is configurable from roughly **1 week to 1 year**. The domain model should represent `startsAt`, `endsAt`, renewal mode and entitlement source rather than hard-code only monthly/yearly products.

Recurring billing can coexist with prepaid fixed terms.

## 4. Creator/Developer value examples

- subscription-only auto-publish eligibility after mandatory automated safety/policy checks;
- more analytics/history;
- automation/API/webhooks;
- enhanced storefront/profile capabilities;
- team/organization tooling where appropriate;
- larger operational quotas;
- selected publishing workflow advantages;
- bundle discounts/credits when commercially justified.

None may bypass malware/integrity/authz checks or buy verification.

## 5. Server plan value examples

Owner approved the full proposed set:

- page customization;
- extended historical analytics;
- APIs/webhooks;
- alerting/automation;
- more media;
- team tools;
- promotion features/discounts or included inventory;
- advanced operational insights.

Core truthful server status and basic discovery must not become fake/inaccurate for free users.

## 6. Organization plan

Organization plans can aggregate seats, team permissions, multi-server/resource management, shared analytics, billing/admin controls, automation and integrations.

## 7. One-time monetization

**DECISION:** prioritize one-time products that are naturally temporary or event-like:

- sponsored placement for a fixed term;
- boost/featured slot;
- campaign/banner inventory;
- eligible publishing/operational service fees;
- other fixed-duration visibility products.

Profile cosmetics alone are not the main purpose of one-time monetization; deeper customization fits subscription value better.

Auto-publish remains subscription-only under the current decision.

## 8. Fixed-price promotion

**DECISION:** initial advertising inventory is fixed-price, not auction/bidding. Every paid placement must be clearly labeled and must not falsify organic ranking, popularity, reviews or verification.

Potential inventory:

- homepage sponsored module;
- server catalog featured slot;
- resource catalog featured slot;
- category/topic sponsorship;
- temporary campaign banner;
- promoted post/content placement subject to content policy.

## 9. Duration and inventory controls

Promotion products should be defined by `placement + audience/scope + start/end + capacity + price + eligibility + content policy`. Avoid selling overlapping inventory that cannot actually be delivered.

## 10. Source-code SKU monetization

Marketplace supports open-source and closed-source goods. Seller may offer source-code access as a separate higher-priced SKU/license with explicit rights. Buyers must be able to see whether they receive binaries, source, updates, support and DRM obligations before purchase.

## 11. Non-purchasable outcomes

Never sell:

- verification verdict;
- removal of legitimate sanctions;
- fake reviews/ratings;
- hidden organic ranking;
- malware/integrity bypass;
- false `Clean Build`/security labels;
- reputation points detached from real evidence.

## 18. Round 4 promotion refinements

- Fixed-price promotion остаётся initial advertising model.
- Server promotion может входить в конкретный subscription tier и/или продаваться отдельным fixed-price inventory item — это задаётся тарифом.
- One-time monetization в первую очередь касается рекламы, продвижения и отдельных publishing/operational actions, а не косметического «скина профиля».
- Sponsored cards можно показывать внутри search/feed в заранее определённых слотах, но они всегда имеют явную маркировку `Sponsored` и не меняют organic ranking score.