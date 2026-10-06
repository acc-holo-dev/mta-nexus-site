# Trust, Public History and Content Moderation

## 1. Trust model

NEXUS Trust is a collection of verifiable signals, not a single opaque score.

The public profile therefore includes a dedicated `Trust / Reputation` tab.

Possible public-safe signals include:

- Verified User/Developer/Seller/Server/Organization relationships;
- verified external links;
- account age/history where safe;
- exact number of completed successful sales/deals;
- verified purchase reviews;
- verified server interaction signals;
- badges/achievements that have real criteria;
- finalized public moderation actions and their current state;
- SCAM/BLACKLIST status where platform case policy supports it.

Do not expose private purchase values, payout amounts, internal staff notes, raw reports or security evidence.

## 2. Moderation history is historical

The owner decision is to retain public moderation history rather than erase it when a warning expires.

A public record must distinguish lifecycle state, for example:

- `active`;
- `expired`;
- `resolved`;
- `overturned_on_appeal`;
- `reduced_on_appeal`;
- `superseded`;
- `blacklisted`;
- `blacklist_removed` if policy later allows removal.

Historical display must not falsely imply that an expired/overturned action is still active.

## 3. First forum topic

A new account's first forum topic is premoderated.

After healthy history the account may publish normal topics immediately, subject to automated checks, rate limits, reports and post-moderation.

## 4. Articles and guides

Owner delegated this design decision. Adopt a trust-tiered model:

- new/low-trust authors: premoderation;
- established authors with healthy history: immediate publish + post-moderation;
- risk flags: can force premoderation again;
- staff may revoke fast-publish capability after abuse.

This supports community growth without making every article a manual bottleneck forever.

## 5. Server news and devlogs

A claimed-server owner/team may publish server news/devlogs immediately when:

- ownership/context is valid;
- no active risk flag blocks it;
- content passes automated policy/security checks where applicable.

The content remains reportable and reviewable.

## 6. Events and contests

Creation is limited to eligible actors, such as approved verified users, claimed servers, organizations or staff. Eligibility is capability-based, not purely badge-based.

Events/contests may enter selective moderation based on risk/content type.

## 7. Paid advertising

Every paid advertisement, boost creative or featured-content creative requires content-policy approval before display.

Paying does not create a policy bypass.

Organic ranking and sponsored placement remain distinct.

## 8. Limits at every trust level

The owner decision is to keep limits everywhere.

Trust/reputation may increase safe quotas for:

- DM requests;
- topics/posts/comments;
- upload attempts;
- publication frequency;
- selected automation.

However no trust level creates unlimited access. Financial, security and high-impact operations remain hard-limited and independently risk-controlled.

## 9. Appeals and evidence

Public Trust history must integrate with the moderation case timeline:

`report → evidence → action → user response → appeal → final decision → public reason/state`

The public view shows only the safe/public layer. Internal evidence and staff notes remain capability-restricted.