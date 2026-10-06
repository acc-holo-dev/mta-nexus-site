# MTA NEXUS Handbook — Revision v0.7

**Date:** 2026-10-06  
**Source:** Owner interview Round 6.

## What changed

Round 6 moved the handbook from high-level product lifecycle into concrete authenticated UX, product delivery and security contracts.

### Workspace and dashboards

- Login keeps the user on Home.
- One adaptive `/workspace` serves multi-role users.
- Seller, Server Owner and Organization dashboards use the full confirmed management/analytics sets.
- Buyer Library is split into Purchased, Free, Trials, Licenses, Updates, Support and Invoices.
- Every purchase/order item has a detail page.

### Product and delivery

- Product cards/pages expose Open Source / Closed Source / DRM state early.
- Rich media and demo links are allowed under content/security policy.
- Compatibility metadata is optional.
- Dependency graph is required.
- Automatic compatibility inference is not required.
- Delisted products are frozen for normal releases.
- Safe free builds may be retained longer than the paid 30-day delist window.

### DRM retention

The prior unresolved edge is closed:

- the 30-day rule governs NEXUS redownload/hosting availability;
- an already active DRM license continues until the end of its contractual paid term;
- malware/legal/security revocation can override normal commercial expiry.

### Support

- Any user can open pre-sale support where allowed.
- Seller subscription may improve operational routing/priority from NEXUS.
- Subscription never changes moderation/dispute fairness.
- Public seller response-time/satisfaction metrics are not required.

### Home, Discover and identity

- Home uses finite ecosystem sections with `Показать больше`.
- Dedicated Community Feed may use infinite scroll.
- `/discover` is required.
- Public profile is visible by default only through safe public fields.
- Immutable User ID is the primary identity.
- Subscription may add a vanity username.
- Verified external links prove control, not quality.
- No command palette/command-driven UX.

### Security and administration

- Security Center is required.
- Role alone does not make 2FA mandatory.
- Global admin case search is required.
- Raw payment/provider payloads use separate restricted debug access.
- Quarantine can stop downloads/activations without destroying evidence.
- Confirmed malware incidents notify affected downloaders.

### API and operations

- API keys/webhooks are not a launch requirement.
- When external API is introduced, the first supported model is authenticated partners/Pro rather than anonymous public API.
- A public NEXUS Status Page is not required; internal observability remains mandatory.

## New chapters

- `33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md`
- `34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md`
- `35-SECURITY-CENTER-QUARANTINE-ADMIN-AND-API.md`
- `36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md`
- `37-HOME-DISCOVER-NAVIGATION-AND-FEEDS.md`

## Next owner interview

Round 7 now asks for exact screen/account/operational behavior: guest permissions, email verification, OAuth, account deletion/export, vanity username expiry, cart/license binding UX, publishing wizard, server page customization, organization permission templates, SCAM/finance dual control, notification/bot policy, PWA/themes/accessibility, and audit retention.