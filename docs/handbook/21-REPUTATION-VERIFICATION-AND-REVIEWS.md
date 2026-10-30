# 21. Reputation, verification и reviews

> Статус: OWNER-CONFIRMED TARGET.

## 1. Core distinction

NEXUS separates three concepts:

1. **Verification** — evidence-backed confirmation of a specific claim/status.
2. **Reputation** — many independent behavioral/history signals.
3. **Reviews** — feedback from users with provable interaction/purchase/claim eligibility.

None of these can be bought as truth.

## 2. Reputation model

**DECISION:** use multiple signals, not one opaque score as the only truth. Candidate signals:

- account age;
- verified identity/ownership statuses;
- completed paid orders;
- successful resource history;
- fulfilled services/projects when that domain exists;
- ratings and review distribution;
- verified server interaction;
- dispute/refund outcome history with careful context;
- moderation violations and sanctions;
- response/support behavior;
- portfolio/public project history;
- GitHub/other linked proof where relevant;
- organization/server ownership track record.

A composite UI summary may be introduced later, but source signals must remain inspectable enough to avoid unexplained reputation magic.

## 3. Verification

**DECISION:** verification is not a paid product. It demonstrates evidence such as meaningful experience, completed work/orders, established project history, verified ownership or other proof defined by the verification type.

Target verification types may include User/Identity, Developer, Seller, Organization, Server and specialized program statuses.

## 4. Developer / Seller verification

Candidate evidence policy confirmed in principle by owner:

- meaningful account/project history;
- successful sales/orders/projects where applicable;
- no unresolved severe violations;
- portfolio and/or public source/project evidence;
- manual review when necessary.

Exact thresholds stay configurable and type-specific. Payment/subscription may not substitute for evidence.

## 5. Review eligibility

**DECISION:**

- paid resource review: only a verified purchaser/entitled buyer;
- free resource review: only a user with a recorded claim/download/eligible interaction;
- server reviews may later use verified interaction evidence rather than arbitrary drive-by ratings.

The UI should label the evidence class (`Verified Purchase`, `Claimed Resource`, etc.) rather than imply quality endorsement by NEXUS.

## 6. Updating reviews

**DECISION:** a reviewer may update an older review, including after a new resource version. Preserve timestamps and preferably material edit history/version context so the seller cannot present an edited review as if it always referred to the newest build.

## 7. Moderation of reviews

Reviews can be removed/limited for spam, conflict of interest, abuse, extortion, impersonation, non-product content or policy violations. Negative but legitimate feedback is not removable merely because a seller dislikes it.

## 8. Badges and evidence labels

Target labels include, where supported by evidence:

- Verified User;
- Verified Developer;
- Verified Seller;
- Verified Server;
- Verified Organization;
- Clean Build;
- DRM Protected;
- Verified Purchase Review;
- Verified Server Interaction;
- Official / Staff.

Each badge must have a documented meaning. Decorative Pro themes cannot imitate or visually overpower trust badges.

## 9. Revocation and expiration

Some verification types may expire or require periodic revalidation. A revoked/expired verification is an auditable state change; historical fact and current status should not be silently rewritten.

## 10. Appeals

Rejected/revoked verification has an appeal path. Appeal should accept additional evidence, preserve the original decision and use independent review where practical.
