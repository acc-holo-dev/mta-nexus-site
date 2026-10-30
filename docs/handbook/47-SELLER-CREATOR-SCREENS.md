# Seller / Creator — Screen Specification

Status: **OWNER-CONFIRMED / TARGET**

## 1. Seller Dashboard

Primary KPI row:

`Revenue / Pending / Sales / Conversion / Refunds`

Below it:

- Product Health;
- action queue;
- support/disputes;
- moderation/review state;
- update/release actions;
- promotions;
- subscription state.

The dashboard must emphasize actions requiring attention, not vanity metrics only.

## 2. Products table

Columns:

`Status / Version / Price / Sales / Rating / Support / DRM / Last update / Risk`

Recommended additional affordances:

- search/filter;
- bulk-safe actions where reversible;
- direct open/edit/release/support links;
- risk/moderation badge with reason access.

## 3. Publish Wizard

The publish workflow is a **dedicated full-page flow**, not a modal.

Stages:

`Basic -> Delivery -> Files/Source -> Dependencies -> Media -> Price/SKU -> DRM -> Support -> Preview -> Publish/Submit`

Key invariants:

- Open Source has no DRM.
- Closed Source seller decides whether to enable DRM.
- security scanning and integrity gates cannot be bypassed by subscription.
- auto-publish entitlement may bypass ordinary manual moderation only when risk state is clean and staff has not revoked the entitlement.

## 4. Seller Analytics

Required controls:

- date range;
- product comparison;
- acquisition/source breakdown;
- funnel `view -> cart -> purchase`;
- revenue;
- refunds;
- downloads;
- updates/version adoption.

Analytics must distinguish operational facts from estimated attribution.

## 5. Promotions Manager

Dedicated manager for:

- boosts;
- featured slots;
- campaign schedule;
- fixed-price purchases;
- campaign state/history;
- spend/result reporting.

Sponsored inventory must remain visibly labelled and cannot secretly rewrite organic rank.

## 6. Seller Support

Unified inbox combines:

- pre-sale questions;
- buyer support tickets;
- purchase/product context;
- status/assignment;
- safe attachments.

Support priority may improve with subscription, but disputes/moderation decisions must remain neutral.

## 7. KYC and payout state

Seller may create/edit drafts before KYC. KYC becomes required before the first payout or earlier if the payment provider legally requires it.

Dashboard should clearly separate:

- `Pending` funds;
- `Available` funds;
- `Paid` funds;
- provider/KYC blocks;
- dispute/refund holds.

## 8. Delist/archive UX

Seller may unlist. Product history and buyer records survive. Archived/delisted public page remains available with reason but without purchase CTA.
