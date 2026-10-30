# License Models, Forensics and Revocation

## 1. Commercial license models

A seller may configure a product SKU as:

- perpetual license;
- time-limited license;
- recurring/subscription resource license.

Existing baseline remains: one commercial license binds to one MTA server unless a future SKU explicitly defines another model.

## 2. Perpetual DRM license

After valid activation, a perpetual DRM license has no ordinary product-use expiry.

It may end only through a formal state transition such as:

- valid refund and associated entitlement revoke;
- confirmed fraud;
- confirmed contractual/license violation under published terms;
- malware/security emergency;
- legal takedown/order;
- owner/admin correction of a demonstrably invalid entitlement.

A seller cannot arbitrarily disable a paid perpetual license without a formal reason flow.

## 3. Seven-day offline grace

The seven-day DRM grace period means the protected resource can continue operating temporarily when NEXUS licensing infrastructure is unreachable.

It is not:

- the purchase lifetime;
- a seven-day trial;
- permission for NEXUS to remotely kill a perpetual license after seven days of normal use.

When the grace expires without a valid refreshed lease, the DRM-protected resource stops until it can revalidate, consistent with the earlier owner decision.

## 4. Time-limited license

A time-limited license has an explicit entitlement end time independent from the offline lease.

Example state:

`active entitlement until T + renewable lease with 7-day offline grace`

The lease can never extend the contractual entitlement beyond allowed policy.

## 5. Forensic watermarking

Forensic protection is seller-opt-in.

The goal is to create customer/license-specific evidence without recompiling the universal DRM runtime for every customer/server.

Possible implementations include:

- signed per-license package manifest;
- customer/license-specific non-secret marker;
- deterministic package transform outside core runtime;
- protected metadata embedded in distributable artifacts;
- server-side record that can correlate a leaked package with a delivery event.

Exact technical design is an engineering/security decision and must be threat-modeled before production.

## 6. Evidence, not automatic guilt

A forensic match creates a suspicion/evidence event and case.

It must not automatically:

- ban the account;
- label the user SCAM;
- revoke unrelated licenses;
- publish an accusation.

False positives, shared infrastructure, copied packages and investigative context must be considered.

## 7. Seller visibility

Seller may see:

- suspected leak exists;
- affected product/version/license as allowed;
- case status;
- final decision/public reason when applicable.

Seller must not receive:

- raw anti-abuse telemetry;
- confidential detection heuristics;
- investigator-only notes;
- personal data beyond policy/legal need.

## 8. Structured revoke flow

Seller-initiated revoke request requires:

1. allowed reason category;
2. affected license;
3. evidence/reference where required;
4. impact preview;
5. audit event;
6. automated or staff review according to risk;
7. buyer notification and appeal/dispute route where applicable.

No unreasoned `Disable license` button.
