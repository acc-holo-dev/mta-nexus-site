# 20. Admin, moderation и appeals

> Статус: OWNER-CONFIRMED TARGET. Current `/admin` already has moderation queues, but this chapter describes the broader target operating model.

## 1. Principle

NEXUS administration is a set of **specialized operational departments**, not one undifferentiated super-user screen. Staff identity is shared, permissions are composable, and every sensitive action is auditable.

## 2. Target admin surfaces

Recommended first-class sections:

- Overview / Operations dashboard;
- Users & Accounts;
- Resources & Builds;
- Servers & Ownership;
- Community & Content;
- Reports & Abuse;
- Verification;
- Trust / SCAM / Blacklist cases;
- Payments, Refunds & Disputes;
- Subscriptions & Entitlements;
- Advertising / Promotion inventory;
- Notifications / Communications;
- Security & Audit;
- Platform configuration with very narrow privilege.

Departments may share queues and case entities; avoid duplicate disconnected moderation systems.

## 3. Staff roles and cumulative capabilities

Target roles/capability bundles include Support, Community Moderator, Content Moderator, Resource Moderator, Server Moderator, Verification Moderator, Dispute/Finance Manager, Security/Trust Moderator, Administrator and Super Admin.

**DECISION:** one employee may hold several of these simultaneously. The implementation should therefore support many-to-many staff assignments or capability grants, not a single exclusive enum.

## 4. Moderation cases

A high-value moderation case should preserve:

- target entity;
- reporter/source;
- evidence references;
- reason codes;
- private staff notes;
- public reason when applicable;
- assigned staff/team;
- state changes;
- actions taken;
- notifications;
- appeal link;
- audit events.

Recommended states: `open -> triaged -> investigating -> actioned | no_action -> appealable/closed`, with separate appeal object/state.

## 5. Sanctions

Supported sanctions are capability-scoped and severity-aware:

1. warning;
2. content removal/unpublish;
3. feature restriction;
4. temporary suspension;
5. permanent ban;
6. high-severity public trust label where policy permits.

A user can, for example, lose selling rights while retaining ordinary community access. Severe malware/fraud cases may jump directly to stronger action.

## 6. SCAM / Blacklist

**DECISION:** `SCAM` / `BLACKLIST` is a controlled platform verdict, not a user-created label. It requires documented evidence and an auditable staff decision.

Public UI should show the substantive reason, decision date/status and appeal availability. Sensitive exploit/security details, PII and protected evidence may be redacted without hiding the actual basis of the decision.

Never implement a free-form public accusation board that automatically damages another user/entity.

## 7. Appeals

**DECISION:** appeals are required for bans/sanctions, content moderation, verification decisions and eligible platform dispute outcomes.

Appeals preserve the original decision and add a new review trail. High-severity appeals should use reviewer separation where possible.

Possible outcomes: `upheld`, `modified`, `overturned`.

## 8. Transparency

Default product principle: public enforcement has a public substantive reason. Private-only cases remain possible where making the case public would expose private user information, security internals or legally protected material.

## 9. Audit

Every privileged mutation should record actor, target, capability used, action, reason, request/correlation identifier where relevant and resulting state. Finance, trust labels, verification and destructive actions need especially strong audit retention.

## 10. Anti-abuse and staff safety

- no silent moderator impersonation;
- no one-click destructive bulk action without explicit safeguards;
- separate view vs mutate permissions for sensitive evidence/finance where useful;
- rate-limit or step-up-auth especially sensitive actions;
- staff cannot purchase/bypass verification outcomes;
- subscription status must not shield a user from moderation.

## 11. CURRENT vs TARGET

CURRENT NEXUS already contains reports, moderation cases, verification and build review concepts plus `/admin` queues. TARGET expands these into specialized operational departments and formal appeal/trust-label workflows.

## 16. case governance

### 16.1 SCAM / BLACKLIST authority

OWNER DECISION: для platform `SCAM/BLACKLIST` verdict достаточно **одного authorized senior Trust/Admin**, если у него есть соответствующая capability.

Обязательны:

- evidence;
- immutable/auditable decision record;
- substantive public reason с redaction safety exceptions;
- appeal path;
- actor identity/time;
- later reversal/review history.

Два staff approvals не являются обязательным условием.

### 16.2 Financial actions

OWNER DECISION: крупные refunds/manual payout corrections **не требуют обязательного второго staff approval** как универсальное правило.

При этом action всё равно должен соблюдать:

- provider authorization;
- role/capability checks;
- re-authentication where risk model requires;
- exact amount/currency/reference validation;
- audit trail;
- idempotency/reconciliation;
- provider/legal limits.

Dual-control может быть добавлен позже для конкретного provider/risk threshold, но не является текущим product invariant.

### 16.3 Unified moderation timeline

Moderation Case хранит единый timeline:

```text
report -> evidence -> triage -> action -> affected-user response
       -> appeal -> review -> final decision -> public reason
```

События append-oriented; исправление создаёт новое событие, а не стирает историю.

### 16.4 Staff note visibility

Каждая заметка/сообщение должна иметь явную audience class:

- `INTERNAL`;
- `VISIBLE_TO_AFFECTED_USER`;
- `PUBLIC_REASON`.

Нельзя делать implicit publication из internal note.

### 16.5 Priority queues

Staff operations имеют очереди и escalation минимум для:

1. Critical Malware/Security;
2. Payment/Settlement;
3. SCAM/Trust;
4. Appeal;
5. Normal Content/Reports.

Queue model поддерживает priority, age/SLA target, assignment/ownership, escalation и audit. Exact SLA minutes/hours задаются позднее по staff capacity и severity.
