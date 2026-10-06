# User Profile and Community — Screen Specification

Status: **OWNER-CONFIRMED / TARGET**

## 1. Public user profile

Primary tabs:

`Overview / Activity / Resources / Servers / Organizations / Reviews / Achievements`

The profile is public by default for explicitly public fields. Payment, security, private ownership records, private purchases and internal moderation data are never exposed by default.

### Overview

Shows:

- avatar, banner, bio;
- immutable identity anchor / public identifier;
- vanity username when entitlement exists;
- verified external links;
- badges and selected achievements;
- selected resources, servers and organizations;
- public social links.

### Activity

Owner decision: **full public activity feed**, constrained by privacy rules and the visibility of the underlying entity.

Examples may include public posts, resource releases, server announcements, reviews, earned achievements and organization activity. Private purchases, private group activity, support, disputes and internal staff actions never enter the public feed.

### Resources / Servers / Organizations

Show public associations only. Membership visibility follows the user's privacy settings and organization/server rules.

### Reviews

Shows eligible public reviews written by the user, subject to moderation and entity visibility.

### Achievements

Community achievements, seasonal badges and awards may be shown. They must not be purchasable as trust signals.

## 2. Trust / Reputation page — OPEN

Round 9 confirms a separate public `Trust/Reputation` profile tab. It aggregates verified evidence, exact successful sales/deals counts, verified reviews/badges and finalized public moderation history without exposing private amounts, internal notes or sensitive evidence.

Current rule:

- trust signals may appear contextually in Overview, Marketplace, Reviews and moderation surfaces;
- do not create a mandatory dedicated public Trust tab until owner approval;
- public sanctions and verification state still follow their already-approved disclosure rules.

## 3. Community `/community`

Top-level sections:

`Feed / Forum / Articles / Events / Groups`

### Feed

- separate from Home;
- may use infinite scroll;
- cursor based;
- permission/moderation aware;
- mixes community activity, not marketplace/server search results.

### Forum

Hierarchy:

`Categories -> Boards -> Topics -> Posts`

Servers and Organizations may operate managed community spaces within the same permission/moderation framework.

### Articles

Long-form guides, editorial pieces and community articles. Some content classes may require premoderation according to risk/promotion policy.

### Events

Events may be created only by eligible actors defined by policy (for example verified entities, servers, organizations or staff), not indiscriminately by every account.

### Groups

Supports public and private/invite-only groups. Groups are distinct from formal Organizations and server ownership structures.

## 4. Messaging entry points

Profiles may provide `Message` according to message-request/block/privacy rules. Pre-sale resource questions may also enter the unified seller support system.

## 5. Username presentation

Immutable User ID remains the permanent identity anchor.

Vanity username:

- requires an eligible entitlement/subscription;
- is held for a 7-day grace period after entitlement expiry;
- is released after grace if entitlement is not restored;
- changing an already-selected vanity username is a separate paid operation;
- historical identity/audit remains anchored to immutable ID.


## Round 9 — Trust tab contract

Public profile navigation includes a dedicated `Trust / Reputation` tab.

It should present verifiable signals and historical state, not a single synthesized score. Exact successful sales/deals counts may be shown. Finalized public moderation history remains visible with status (active/expired/overturned/etc.), while internal evidence and private financial/security data remain hidden.