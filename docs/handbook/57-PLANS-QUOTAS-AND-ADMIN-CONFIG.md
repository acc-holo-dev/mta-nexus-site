# Plans, Quotas and Protected Admin Configuration

Status: **OWNER-CONFIRMED TARGET**

## 1. Why three levels

Creator, Server and Organization each use `Free / Pro / Business`. This is not cosmetic naming: each family has three genuinely different usage modes — base participation, professional automation/analytics, and high-volume/team/business operation.

Exact money prices, quotas and individual feature entitlements remain configuration so the business can evolve without migrations for every tariff change.

## 2. Creator plans

### Free

- sell real products;
- manual product moderation;
- mandatory automated safety/integrity checks;
- base analytics and quotas;
- starting marketplace commission 10%;
- baseline payout hold 7 days.

### Pro

- auto-publish eligibility when risk state allows;
- advanced analytics/automation;
- higher quotas;
- promotions manager/value;
- starting commission target 8%;
- hold target 3 days when trust/risk/provider policy allows.

### Business

- highest standard creator quotas;
- stronger team/workflow/automation value;
- highest standard commercial benefits;
- starting commission target 6%;
- hold target 1 day only when high-trust/risk/provider conditions permit.

A subscription never buys verification, moderation victory, dispute priority, security bypass or guaranteed payout timing.

## 3. Server plans

### Free
Core claim/management, truthful directory presence, base page/community and essential server information.

### Pro
Richer page builder/media, deeper history/analytics, recruitment/events, promotion tooling and higher quotas.

### Business
Highest standard team/media/history/management quotas, advanced workflows/automation and integration/export capabilities when those platform contracts are available.

## 4. Organization plans

### Free
Organization identity, core members/permissions and collaborative ownership.

### Pro
Larger team/assets, analytics, billing/operations tooling and higher quotas.

### Business
Highest standard organization quotas, finance/audit/workflow/automation capabilities for serious teams.

Organization pricing is per organization, not per-seat by default.

## 5. NEXUS Pro

`NEXUS Pro` is one maximal bundle/support subscription, not another tier ladder. It combines eligible personal cross-pillar benefits and includes benefits for **one selected Organization**.

Discounts/commission benefits do not stack below the best configured eligible rate unless an explicit admin policy says otherwise.

## 6. Commercial defaults

- Creator commission targets: 10% / 8% / 6%;
- hold targets: 7d / 3d / 1d when eligible;
- trial maximum: 7 days;
- included support periods: 7 / 30 / 90 / 365 days;
- ordinary dispute window: 14 days;
- subscription duration system remains flexible from roughly 7 to 365 days.

## 7. Product-price floor

Seller selects price. Effective minimum is computed from provider and admin policy rather than a magic universal amount:

`max(provider minimum, configured currency floor, fee-safety floor)`

This avoids uneconomic microtransactions while preserving seller control.

## 8. Artifact-size default

The owner did not select a file-size number because the concept was unclear. Therefore the handbook records a **PROVISIONAL launch technical default of 512 MiB per build**.

Meaning: one uploaded resource build/archive may not exceed that size unless an authorized configuration/exception allows it. This exists to protect upload bandwidth, malware scanning, storage and delivery costs. It is not a statement that MTA scripts should be large, and it should be revisited from real artifact telemetry.

## 9. Payout floor

Prefer PSP/marketplace-provider payout minimums. NEXUS adds a platform threshold only when real provider fees or operations require one. Do not make sellers accumulate funds unnecessarily.

## 10. Admin configuration security

Plan/economics configuration is high-impact. Changes require:

- dedicated capability;
- re-auth for especially sensitive finance changes;
- reason;
- actor/timestamp;
- old/new value;
- effective date/version;
- immutable audit event;
- impact preview when changing live economics.

Orders, subscriptions and payouts must retain a snapshot/reference of the policy actually applied, so changing today's commission does not rewrite historical accounting.

## 11. What must stay configurable

At minimum:

- prices per plan and duration;
- commission percentages;
- hold rules;
- eligibility thresholds;
- quotas/storage/media/team limits;
- artifact-size limits;
- one-off promotion/publication prices;
- product price floors;
- payout floors;
- trial maximum;
- promotion inventory/capacity.