# Revision v0.6 — Owner Interview Round 5

Date: 2026-10-06

## Added

- `28-CART-LICENSES-AND-ACCESS-RIGHTS.md`
- `29-SUPPORT-TRIAL-WISHLIST-AND-BILLING-UX.md`
- `30-SERVER-OWNERSHIP-STATUS-AND-JOIN.md`
- `31-ORGANIZATION-COMMERCE-AND-MESSAGING-POLICY.md`
- `32-LAUNCH-ONBOARDING-AND-PRODUCTION-GATES.md`

## Major decisions incorporated

- Cart is the target checkout model.
- Default commercial license is one MTA server.
- Delist and seller-ban access window is 30 days rather than permanent redownload.
- Trial/demo and Wishlist are target requirements.
- Support is unified under NEXUS; seller can set included support term.
- Local currency estimates, provider-driven tax/VAT, seller settlement UI and invoices/receipts are required.
- Keep MTA challenge for server claim; support co-owners and audited ownership transfer.
- Add server maintenance/incidents/events and Join Server action; keep player identities private by default.
- Organizations have their own billing profile and can own paid products/receive payouts.
- Message Requests for strangers (delegated decision), full blocking and private groups; no native voice/video.
- One Home architecture for guest/auth users; registration onboarding required.
- Command/action palette is not a target requirement.
- First public launch target is Open Beta for everyone.
- Real payments remain blocked behind an explicit legal/provider/security/operations production gate.

## Open edge deliberately preserved

The owner has not yet chosen what happens to an already-active DRM license after the 30-day post-delist/post-seller-ban window. This must not be guessed for production.