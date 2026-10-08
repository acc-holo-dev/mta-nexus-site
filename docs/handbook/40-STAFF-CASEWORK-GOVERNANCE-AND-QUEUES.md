# MTA NEXUS — Staff Casework, Governance и Queues

> Статус: OWNER DECISION / TARGET SPEC, Round 7.

## 1. Case-centric operations

Staff работает не через случайный набор modal-actions, а через case records с timeline, evidence и решениями.

Core case categories:

- malware/security;
- scam/trust;
- content/resource moderation;
- verification;
- payment/settlement;
- dispute/refund;
- appeal;
- account/server/organization ownership.

## 2. Unified timeline

```text
Report
 -> Evidence
 -> Triage
 -> Investigation
 -> Action
 -> User response
 -> Appeal
 -> Review
 -> Final decision
 -> Public reason / closure
```

Каждое действие хранит actor, timestamp, capability, reason и affected entities.

## 3. Staff note audiences

- `INTERNAL`: staff-only evidence/thoughts/security context;
- `VISIBLE_TO_USER`: communication affected party can see;
- `PUBLIC_REASON`: text intended for public transparency surfaces.

Conversion между audiences — explicit action, не automatic copy.

## 4. Queue priorities

Minimum queues:

1. Critical Malware / Security;
2. Payment / Settlement;
3. SCAM / Trust;
4. Appeal;
5. Normal Content / Reports.

Queue engine supports:

- severity/priority;
- assignment;
- age/SLA target;
- escalation;
- dependency on other cases;
- bulk filters, not blind bulk actions;
- audit.

## 5. SCAM / BLACKLIST decision authority

Одного authorized **senior Trust/Admin** достаточно для verdict.

Mandatory safeguards:

- evidence;
- public reason;
- appeal;
- audit;
- immutable history of later reversal/update;
- redaction of PII/security-sensitive evidence.

Crowd votes/reports никогда сами не создают SCAM label.

## 6. Financial correction governance

Second staff approval не является обязательным universal product rule для refund/manual payout correction.

Но любой correction требует:

- correct Finance capability;
- provider-side authorization;
- re-auth where sensitive;
- idempotency/reconciliation;
- immutable audit;
- reason and exact references.

Risk/provider policy может добавить dual-control позже без изменения базовой business philosophy.
## 7. Support status concurrency (implemented)

- Staff `PATCH /api/support/:id` requires both `status` (requested) and `expectedStatus` (last status shown to staff).
- If stored status differs from `expectedStatus`, return private `409 SUPPORT_STATUS_CONFLICT` and reload the case in the client. Do not record status audit or notify the requester.
- Matching no-op is idempotent, without duplicate audit/notification. Real changes use a PostgreSQL compare-and-set inside the audit transaction, protecting a race after the read.
- The precondition compares status values, not an immutable revision. A full `open -> resolved -> open` ABA cycle is not detected; add a revision token if stronger ordering is needed.

## 8. Staff support filtering (implemented)

- Authorized staff can filter the queue by case status and category. The customer view remains requester-scoped.
- Server filtering uses validated query values, consistent count/page predicates and a composite index.
- Status and category controls have English and Russian copy. Changing a filter resets pagination. Stale list fetches are aborted and ignored.
- This is a queue browsing feature, not an assignment or adjudication mechanism.
