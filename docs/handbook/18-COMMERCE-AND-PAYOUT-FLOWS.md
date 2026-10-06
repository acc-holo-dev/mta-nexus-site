# 18. Commerce, payments, payouts и disputes

> Статус: target business architecture v0.3. Production activation требует legal/provider/refund/payout acceptance.

## 1. Confirmed principles

- paid marketplace;
- 10% platform commission;
- subscriptions + one-time paid features;
- broad multi-provider/multi-method payment layer;
- disputes mandatory;
- minimize owner manual ops/cost in payouts;
- verification is not sold.

## 2. Domain boundaries

Keep separate: `Order`, `Payment`, `Purchase`, `License/Entitlement`, `Ledger`, `Payout`, `Refund`, `Dispute`.

## 3. Checkout

`Buy → immutable order snapshot → PSP checkout → verified webhook/API state → payment succeeded → purchase → license/entitlement → accounting`. Client redirect is never proof of payment.

## 4. Commission

Confirmed fee = **10%**. OPEN before launch: fee base after discounts, taxes, PSP fee allocation, refunds, chargebacks, minimum price and rounding.

## 5. Provider strategy

Use provider abstraction/capability matrix for countries, currencies, payment methods, marketplace/split payout, seller KYC, subscriptions, refunds, webhooks, fees and settlement delay. Goal: maximum practical coverage, not one hard-coded PSP.

## 6. Preferred payout model

Owner wants minimal manual operations/cost. Prefer `buyer → marketplace-capable PSP → provider split/settlement → seller payout + platform fee` when feasible. Internal ledger/payout orchestration is fallback with higher legal/accounting burden.

## 7. Dispute flow

`Open dispute → reason/evidence → seller response → protect settlement where possible → review → resolution → refund/partial/release/reject → audit/notifications`. PSP chargeback is separate from internal dispute but must reconcile.

## 8. Subscription billing

Support term-based plans from roughly 7 days to 1 year, recurring plans where useful/provider-supported, cancellation/end-of-period, failed renewal handling, upgrade/downgrade, entitlement derivation and webhook reconciliation. Plans may be pillar-specific and bundled. Exact prices remain OPEN.

## 9. Promotion inventory

Sponsored server/resource placement is allowed, must be visibly labeled and separated from organic/trust ranking. **DECISION:** initial advertising/promotion inventory uses fixed-price terms rather than auction/bidding.

## 10. Auto-publish entitlement

Subscription may grant `auto_publish`: skip manual queue according to policy, never skip malware scan, integrity, authorization or required automated policy checks. Abuse can revoke capability.

## 11. Verification boundary

Paid tools can improve workflow, analytics, automation, branding and promotion. They cannot purchase the truth-value of a verification badge.


## 12. Refund policy direction

DECISION: digital download does not automatically imply no-refund under all circumstances. Internal dispute/refund reasons include at least:

- product materially does not work as represented;
- product materially does not match description;
- duplicate purchase;
- fraud/unauthorized purchase;
- other staff-approved exceptional cases.

Eligibility windows/evidence requirements/partial refund rules remain launch-policy details.

## 13. Decision authority

DECISION: normal internal marketplace disputes are decided by authorized NEXUS staff according to policy and evidence. PSP/bank chargebacks are separate external processes handled/reconciled with the provider and must not be falsely represented as a NEXUS-only verdict.

## 14. One-time paid inventory boundary

One-time products are primarily promotion/advertising and specific publishing/operational services. They must not bypass malware/integrity checks, buy verification or convert sponsored ranking into hidden organic ranking. Auto-publish remains a subscription capability under the earlier owner decision unless the owner explicitly changes it.

## 19. Round 4 financial rules

### Commission base

NEXUS получает **10% от суммы, реально оплаченной покупателем после скидки**. PSP fees/tax/provider settlement могут рассчитываться отдельно согласно конкретному provider contract и юрисдикции.

### Initial hold

Base seller hold = **7 days** before funds become payable/settled. Risk/trust/subscription policy может изменять hold, но точные условия должны быть публичными и auditable.

### Refund authority

Seller не имеет untracked unilateral refund control. Refund создаётся через platform/provider workflow, чтобы корректно изменить Payment, Purchase, License/Entitlement, commission, dispute и audit state.

### Services / Guarantee

Commercial target включает services/custom development и Deal/Guarantee. Их funds flow нельзя реализовывать как самодельный неаудируемый wallet; предпочтительны PSP marketplace/escrow-like capabilities там, где они legally/provider-supported.

## 20. Round 5 — billing UX, tax и provider responsibility

### 20.1 Cart checkout

DECISION: коммерческий checkout строится вокруг **cart**, а не только single-item Buy Now. Cart может содержать несколько совместимых Product/SKU и должен рассчитывать:

- subtotal;
- seller/platform discounts;
- coupons/promos;
- tax/VAT where applicable;
- PSP/provider fee presentation where legally/contractually appropriate;
- total in settlement currency;
- approximate local-currency display where available.

Order items остаются отдельными domain records, чтобы refund/dispute/license decisions не требовали отменять весь order целиком.

### 20.2 Tax/VAT direction

DECISION: где возможно, tax/VAT calculation/collection/reporting следует передавать PSP/Merchant-of-Record/marketplace provider capability. NEXUS не должен сам становиться налоговым движком без необходимости.

Это не отменяет обязанность владельца бизнеса проверить реальную юрисдикцию, invoices, accounting и provider contracts до production activation.

### 20.3 Seller balance UI

DECISION: seller dashboard показывает ledger-like settlement view даже если NEXUS не custody-holder:

- pending;
- on hold;
- available/provider-payable;
- paid;
- refunded;
- disputed/reserved;
- NEXUS commission;
- PSP fees when known.

UI не должен называть provider-held funds «банковским счётом NEXUS» или создавать ложное впечатление stored-value wallet.

### 20.4 Receipts and invoices

DECISION: purchase history хранит/связывает receipts, invoices, credit/refund documents там, где их поддерживает provider/legal regime. Документ должен ссылаться на immutable order/payment identifiers и фактический provider result.

### 20.5 30-day seller/delist access rule

OWNER DECISION: если seller добровольно снимает product с продажи или seller account блокируется, existing buyers получают **30-дневное окно** для доступа к разрешённой последней версии/материалам согласно policy. После этого NEXUS не обещает постоянный redownload/hosting.

Exceptions:

- malware/security takedown может закрыть download немедленно;
- legal/copyright/provider order может требовать иной срок;
- purchased open-source copy, уже законно полученная пользователем, физически не может быть «отозвана» NEXUS;
- точное поведение уже активированной DRM-license после истечения 30 дней должно быть явно специфицировано до production commerce. Пока не выдумывать его из этого пункта.

Это правило должно быть очень заметно в Seller Agreement, buyer purchase UI и Refund Policy, поскольку оно отличается от модели «вечный redownload».