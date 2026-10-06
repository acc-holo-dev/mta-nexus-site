# MTA NEXUS — AI Context Index

> Короткий навигатор по полному handbook. Не заменяет файлы ниже.

## Read order

1. `00-README.md` — назначение handbook и статусы истины.
2. `01-PROJECT-CONCEPT.md` — зачем существует MTA NEXUS.
3. `13-DECISION-REGISTER.md` — что подтверждено, а что открыто.
4. `02-ROLES-AND-PERMISSIONS.md` — пользователи, developer/server owner/moderator/admin/seller concept.
5. `03-FEATURES-AND-SURFACES.md` — функциональная карта сайта.
6. `04-TRUST-SAFETY-SECURITY.md` — почему платформе можно доверять и какие invariants нельзя ломать.
7. `05-UX-AND-DESIGN.md` — UX/RU-EN/responsive/accessibility principles.
8. `06-BUSINESS-MODEL.md` — current free beta и варианты будущей монетизации.
9. `07-TECHNICAL-ARCHITECTURE.md` — stack/runtime/boundaries.
10. `08-DOMAIN-AND-DATA-MODEL.md` — entities/state machines/relationships.
11. `09-OPERATIONS-TESTING-RELEASE.md` — development, CI, backup, release.
12. `10-ROADMAP.md` — последовательность развития.
13. `11-AI-AGENT-HANDOFF.md` — обязательные правила следующему AI-агенту.
14. `12-INTERVIEW-QUESTIONS.md` — вопросы владельцу для закрытия неопределённостей.
15. `14-SOURCE-MAP.md` — происхождение решений и legacy/current boundary.
16. `16-DOCUMENTATION-INTEGRATION-PLAN.md` — migration handbook в repository docs после owner review.

## Five facts that prevent the most dangerous mistakes

1. Current closed beta is still free and paid checkout/payout/crypto/DRM are not enabled, **but owner has confirmed paid marketplace, 10% commission, subscriptions/one-time monetization and mandatory DRM as target direction**.
2. A public downloadable build must be published and have clean scan provenance with scanner identity and scan timestamp.
3. Current architecture is a modular monolith. Do not reintroduce old distributed infrastructure without evidence.
4. Current authorization is based on current actor/ownership/membership, not historical authorship.
5. Legacy `mta-market-platform` is reference material, not current implementation truth.

## Owner-confirmed autonomy and human gates

AI may autonomously choose development tasks, refactor architecture, add features/dependencies, create migrations, optimize CI/tests and commit/push coherent slices to `main`.

Already confirmed: paid marketplace = yes, commission = 10%, subscriptions/one-time monetization = yes, no mandatory seller application, DRM = mandatory target.

Human gate remains for destructive production data operations, production deployment, real payment credentials/activation, changes to agreed financial/legal policy, payout/escrow legal activation and privacy changes that expose previously private data.



## Handbook v0.4 additions

After Decision Register and AI Handoff, read these when the task touches the domain:

- `20-ADMIN-MODERATION-AND-APPEALS.md` — staff, sanctions, blacklist, appeals;
- `21-REPUTATION-VERIFICATION-AND-REVIEWS.md` — verification/reputation/review evidence;
- `22-SUBSCRIPTIONS-PROMOTION-AND-MONETIZATION.md` — plans, term entitlements, ads and paid inventory.

## v0.5 additional reading for commercial/social work

- Marketplace/product work: `23-MARKETPLACE-PRODUCT-LIFECYCLE.md`
- Server/org/profile work: `24-SERVERS-ORGANIZATIONS-AND-PROFILES.md`
- Services/deal work: `25-DEALS-SERVICES-AND-GUARANTEE.md`
- Search/ranking/ads/recommendations: `26-SEARCH-RANKING-ADS-AND-PERSONALIZATION.md`
- Messaging/groups/community systems: `27-MESSAGING-GROUPS-AND-SOCIAL-SYSTEMS.md`

For any conflict, latest owner decision in `13-DECISION-REGISTER.md` wins over legacy intent, while current runtime facts still come from current `main`.

## v0.6 additional reading

- Checkout/license access: `28-CART-LICENSES-AND-ACCESS-RIGHTS.md`
- Support/trials/wishlist/billing UX: `29-SUPPORT-TRIAL-WISHLIST-AND-BILLING-UX.md`
- Server ownership/status/join: `30-SERVER-OWNERSHIP-STATUS-AND-JOIN.md`
- Organization finance + messaging: `31-ORGANIZATION-COMMERCE-AND-MESSAGING-POLICY.md`
- Public launch/onboarding/payment gate: `32-LAUNCH-ONBOARDING-AND-PRODUCTION-GATES.md`

Round 6 closed the prior DRM retention edge: the 30-day window limits NEXUS redownload/hosting, while an already activated DRM license continues until the end of its contractual paid term, subject to malware/legal/security revocation.

## v0.7 additional reading

- Unified Workspace/dashboards/library: `33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md`
- Product page/dependencies/delivery: `34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md`
- Security Center/quarantine/admin/API: `35-SECURITY-CENTER-QUARANTINE-ADMIN-AND-API.md`
- Identity/public profiles/verified links: `36-IDENTITY-PROFILES-AND-VERIFIED-LINKS.md`
- Home/Discover/navigation/feeds: `37-HOME-DISCOVER-NAVIGATION-AND-FEEDS.md`

Round 6 also establishes that API/webhooks are not launch blockers, the first external API is authenticated partner/Pro-only, public Status Page is not required, and role alone does not force 2FA.

## Round 7 additions

Before implementing account/auth, seller publishing, staff workflows or release UX, also read:

- `38-ACCOUNT-AUTH-AND-LIFECYCLE.md`;
- `39-SELLER-PUBLISHING-KYC-AND-CATALOG-STATES.md`;
- `40-STAFF-CASEWORK-GOVERNANCE-AND-QUEUES.md`;
- `41-PWA-THEMES-ACCESSIBILITY-AND-NOTIFICATIONS.md`;
- `42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md`;
- `43-ROLE-SURFACE-MAP.md`.

Do not reintroduce OAuth login, anonymous public API, mandatory role-based 2FA, Telegram/Discord bots, perpetual unbound license activation, arbitrary server-page HTML/JS or hidden unlogged finance corrections without an explicit newer owner decision.


## Screen-by-screen implementation pack (v0.9)

When implementing UI flows, read these together:

1. `43-ROLE-SURFACE-MAP.md` — role/surface access map.
2. `44-GUEST-HOME-DISCOVER-SCREENS.md` — public shell/Home/Discover.
3. `45-USER-PROFILE-COMMUNITY-SCREENS.md` — user/community.
4. `46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md` — buyer lifecycle.
5. `47-SELLER-CREATOR-SCREENS.md` — seller lifecycle.
6. `48-SERVER-OWNER-SCREENS.md` — server owner operations.
7. `49-ORGANIZATION-SCREENS.md` — organization operations.
8. `50-STAFF-OPERATIONS-SCREENS.md` — moderator/support/finance/admin.
9. `51-PRICING-SUBSCRIPTIONS-ERROR-OFFLINE-UX.md` — pricing/expiry/offline/error behavior.

If a screen spec conflicts with an older generic UX description, use the newer owner-confirmed screen spec unless CURRENT code/security invariant makes it unsafe. The dedicated public Trust/Reputation tab is confirmed; implement it as evidence/history, not a single opaque score.


## Round 9 quick index

- Economics/commission/holds: `52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md`
- Public Trust/history/moderation matrix: `53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md`
- License lifetime/forensic/revoke: `54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md`
- Production storage/scanners/observability: `55-PRODUCTION-STORAGE-SCANNERS-AND-OBSERVABILITY.md`
- Support/SLA/dispute timing: `56-SUPPORT-SLA-AND-DISPUTE-TIMING.md`

If old text says Trust tab or forensic watermarking are OPEN, Round 9 supersedes it. The only observability question still OPEN is authority to bind production to concrete vendor/tooling, not the need for monitoring capabilities.