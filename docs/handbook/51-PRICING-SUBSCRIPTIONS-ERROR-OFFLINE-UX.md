# Pricing, Subscriptions, Offline and Error UX

Status: **OWNER-CONFIRMED / TARGET**

## 1. Public pricing `/pricing`

One public comparison page covers:

- Creator plans;
- Server plans;
- Organization plans;
- NEXUS bundle plans.

The same plans may surface contextually inside Workspace, but contextual upsell must link back to transparent plan details.

## 2. Pricing transparency

Before purchase, show clearly:

- price and selected duration;
- included capabilities/quotas;
- marketplace commission effects where plan changes them;
- payout hold-time advantages where plan changes them;
- automation rights;
- promotion allowances/discounts;
- expiry consequences.

Do not hide material economic conditions behind marketing copy.

## 3. Duration

Subscriptions support configurable paid durations from roughly **one week to one year** rather than only monthly/yearly presets.

## 4. Expiry behavior

When a subscription expires:

- paid-only automation stops;
- active promotions stop according to purchased campaign terms;
- plan-only capabilities are disabled;
- configuration/data is retained so resubscription can restore the feature without rebuilding setup;
- access to already-owned purchases/licences follows their own contract, not subscription state.

## 5. Vanity username grace

Vanity username entitlement receives a **7-day grace/reservation period** after expiry. If the entitlement is not restored, the slug is released for reuse.

Immutable User ID remains unchanged forever within retained identity/audit records.

## 6. PWA offline UX

The PWA may render cached shell/read-only data while offline.

It must display a clear `Offline` state and block state-changing actions rather than enqueue them optimistically, including:

- payment/checkout completion;
- license activation/transfer;
- publishing/releases;
- moderation/staff actions;
- ownership/finance changes.

Read-only cached content must be visibly marked if freshness matters.

## 7. Production error pages

For `403`, `404`, `409`, `429` and `5xx`:

- show an understandable human message;
- show safe recovery action where possible;
- provide request/correlation ID for support;
- never expose stack traces, secrets, SQL, filesystem paths or provider raw payload.

## 8. Theme/accessibility

Release target includes:

- Light / Dark / System;
- installable PWA;
- Web Push infrastructure;
- WCAG 2.2 AA target for key account and commerce flows.


## Round 9 pricing contract additions

Pricing must communicate the following even before exact amounts are finalized:

- current baseline marketplace commission: **10%**;
- paid Creator plans may reduce commission in the future;
- payout hold starts at 7 days for a new seller and may improve with subscription/verification/history;
- `Creator Free` supports real selling with manual moderation;
- `Creator Pro` family adds automation/analytics/promotion capabilities;
- one-off accelerated publication may be purchased without a recurring plan;
- Server paid offering supports multiple tiers and one-off add-ons;
- Organization paid access is priced per organization;
- NEXUS Pro is the broadest bundle across ecosystem pillars;
- base prices are globally consistent while display currency may be converted locally.

Do not fabricate exact prices/discount percentages/quotas until approved.