# Revision v0.9

Date: 2026-10-06

## Scope

Round 8 converted the handbook from role/surface mapping into explicit screen-by-screen UX contracts.

## Added

- `44-GUEST-HOME-DISCOVER-SCREENS.md`
- `45-USER-PROFILE-COMMUNITY-SCREENS.md`
- `46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md`
- `47-SELLER-CREATOR-SCREENS.md`
- `48-SERVER-OWNER-SCREENS.md`
- `49-ORGANIZATION-SCREENS.md`
- `50-STAFF-OPERATIONS-SCREENS.md`
- `51-PRICING-SUBSCRIPTIONS-ERROR-OFFLINE-UX.md`

## Owner decisions captured

- Home hero/search/trending and contextual guest CTA model.
- `/discover` deliberately avoids a mixed all-entity result stream.
- Public profile activity is a feed; separate Trust/Reputation tab remained OPEN at v0.9 because the owner had not yet approved it. **Superseded by Round 9 / v0.10: Trust/Reputation tab is CONFIRMED.**
- Buyer purchase detail uses tabs; license activation reminders at 7/3/1 days.
- Seller/Server/Organization operational dashboards are now specified.
- Server and Organization share the same capability engine.
- Staff surfaces use role-aware queues, case timeline, impact preview and strict capability separation.
- Public pricing/plan economics are transparent.
- Vanity username receives a 7-day post-entitlement reservation grace.
- Offline PWA blocks sensitive writes; error pages expose support-safe correlation IDs only.

## Supersession notes

Where older docs describe `/discover` as a mixed ecosystem stream, v0.9 supersedes that presentation: discovery remains cross-ecosystem but uses separate entity tabs/sections, not mixed heterogeneous cards in one result stream.