# Staff Operations — Screen Specification

Status: **OWNER-CONFIRMED / TARGET**

## 1. Staff Home

Role-aware operations dashboard showing only authorized domains.

Core modules:

- assigned cases;
- SLA / escalation alerts;
- critical incidents;
- queue counters;
- recent high-risk actions;
- workload by queue;
- quick search.

Priority queues include:

`Critical Malware / Payment / Scam / Appeal / Normal Content`

## 2. Case detail

Recommended layout:

1. Entity/case summary.
2. Evidence and unified case timeline.
3. Action / reason panel.

Case timeline model:

`report -> evidence -> action -> response -> appeal -> final decision -> public reason`

Notes are explicitly classified as:

- Internal;
- Visible to user;
- Public reason.

## 3. Impact preview

Before high-impact actions such as sanction, quarantine or refund, show an impact preview covering as relevant:

- users affected;
- downloads/build availability;
- licenses/activations;
- payments/refunds;
- notifications that will be sent;
- public status/reason changes.

This is an operator safety layer, not a substitute for authorization checks.

## 4. Support staff boundaries

Support can see the purchase/license/product context needed to help the user. Raw PSP payload and internal Trust notes require separate capabilities.

## 5. Finance staff boundaries

Finance can access orders, payments, refunds, payouts and finance-related disputes. It cannot change content/moderation verdicts unless the same staff member also has the relevant moderation capability.

Raw provider data is behind restricted debug access and audit.

## 6. Moderator / Trust

Moderation operates specialized queues and can quarantine suspicious resources/builds without physically deleting evidence.

A single senior Trust/Admin may issue a SCAM/BLACKLIST verdict, but evidence, audit, full public reason policy and appeal are mandatory.

## 7. Super Admin / System

Emergency/system controls live in a separate `System` section.

Required safeguards:

- explicit reason;
- re-authentication / step-up;
- capability check;
- immutable audit event;
- impact preview where meaningful.

System tools must not be mixed into ordinary content moderation navigation.

## 8. Global staff search

Authorized staff search may locate by:

`User / Server / Resource / Order / Payment / License / IP / Audit ID`

Results must be capability-filtered and every sensitive lookup may be auditable.