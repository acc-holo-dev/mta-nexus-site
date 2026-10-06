# Production Storage, Scanners and Observability

## 1. Provider-agnostic payment layer

Before legal entity, launch jurisdiction and provider contracts are approved, production payment architecture must remain provider-agnostic.

Provider adapters should isolate:

- checkout/payment creation;
- webhook verification;
- settlement state;
- refund/chargeback events;
- marketplace/split payout state;
- KYC/onboarding references;
- provider-specific identifiers/raw payload access.

Do not hard-code product semantics around one PSP before the production business gate.

## 2. Production artifact storage

Commercial marketplace artifacts target:

- private object storage;
- immutable object identity/versioning policy;
- signed/authorized download URLs or equivalent authenticated delivery;
- CDN delivery where appropriate;
- metadata integrity validation;
- explicit retention/deletion rules;
- backup/recovery or origin durability appropriate to the provider.

Local filesystem storage remains acceptable for local development/tests and controlled fallback workflows, not the intended commercial production origin.

## 3. Scanner architecture

ClamAV remains the baseline malware scanner because the current product already uses it and its fail-closed behavior is part of the safety invariant.

The target architecture should expose a scanner/reputation interface so additional engines can be attached without changing product publishing semantics.

Conceptual result model:

- scanner identity/version;
- verdict;
- scanned timestamp;
- artifact hash/size binding;
- diagnostics safe for staff;
- normalized reason/status;
- retryability/failure classification.

A scanner outage or incomplete scan is never equivalent to `clean`.

## 4. Multiple scanners

Future policy may combine:

- ClamAV;
- commercial antivirus/reputation services;
- static MTA/Lua resource inspection;
- archive/content validation;
- known-hash reputation;
- manual quarantine/review.

Exact vendors are implementation/business decisions.

## 5. Observability capability requirements

Production operation will eventually need at least:

- centralized application/infrastructure logs;
- metrics;
- error tracking and/or tracing;
- uptime/health monitoring;
- backup-job monitoring;
- malware/scanner health monitoring;
- payment webhook/settlement failure visibility;
- security alerts;
- correlation/request IDs;
- incident investigation data with access control and retention policy.

These capabilities are requirements, not approval of a particular vendor.

## 6. OPEN: vendor selection authority

Round 9 question 30 was not understood/approved by the owner.

Therefore **OPEN**:

> May an AI agent choose concrete production observability vendors/tools as a reversible `PROVISIONAL` engineering decision, or must it ask the owner before binding production to those services?

Until resolved:

- AI may implement provider-neutral interfaces;
- AI may use local/dev open-source tooling provisionally;
- AI must not present a paid third-party production monitoring vendor as owner-approved;
- credentials/contracts/data-export to external observability providers remain a production gate.