# Task-directed context map

Start at [AGENTS.md](../../AGENTS.md), run `pnpm agent:brief`, then read the selected
[queue task](59-DEVELOPMENT-QUEUE.md). The old sequential 16-document read order is
replaced by this map. Open only relevant headings, callers, contracts and tests.
Use `rg -n` for decisions/paths, then read the matching section. Broaden when a
cross-domain invariant requires it. No summary overrides source evidence.

| Task area | First source locations | Domain decisions to consult |
|---|---|---|
| Auth/session/privacy | `apps/web/src/lib/services/auth-service.ts`, `packages/security/src`, `packages/db/src/repositories/auth.ts`, HTTP adapters | [Account lifecycle](38-ACCOUNT-AUTH-AND-LIFECYCLE.md), [security](04-TRUST-SAFETY-SECURITY.md) |
| Free resource publishing/download | `apps/web/src/lib/services/product-service.ts`, `packages/db/src/repositories/builds.ts`, `packages/storage/src` | [Product lifecycle](23-MARKETPLACE-PRODUCT-LIFECYCLE.md), [delivery](34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md) |
| Library/cart/collections | `apps/web/src/app/workspace`, library services and repositories | [Buyer screens](46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md), [access](28-CART-LICENSES-AND-ACCESS-RIGHTS.md) |
| Servers/ownership | `apps/web/src/lib/services/mta-master-directory-service.ts`, server services/repositories | [Server policy](30-SERVER-OWNERSHIP-STATUS-AND-JOIN.md), [owner screens](48-SERVER-OWNER-SCREENS.md) |
| Organizations/context | organization services/repositories, auth context routes | [Organization policy](31-ORGANIZATION-COMMERCE-AND-MESSAGING-POLICY.md), [screens](49-ORGANIZATION-SCREENS.md) |
| Community/notifications | content/discussion/follow services, inbox/push/mail repositories and workers | [Community](19-COMMUNITY-AND-RETENTION.md), [notifications](41-PWA-THEMES-ACCESSIBILITY-AND-NOTIFICATIONS.md) |
| Moderation/reports/trust | admin/report/verification routes, matching services/repositories | [Casework](40-STAFF-CASEWORK-GOVERNANCE-AND-QUEUES.md), [trust](53-TRUST-PUBLIC-HISTORY-AND-CONTENT-MODERATION.md) |
| UI style/navigation | `packages/ui/src`, `apps/web/src/app/globals.css`, `apps/web/src/lib/i18n.ts`, neighboring screen | [Design](05-UX-AND-DESIGN.md), [role map](43-ROLE-SURFACE-MAP.md), relevant screen chapter 44–51 |
| Data/migrations | `packages/db/src`, `packages/db/migrations`, matching integration test | [Data model](08-DOMAIN-AND-DATA-MODEL.md), [architecture](../ARCHITECTURE.md) |
| Dependencies/CI/runtime | manifests, lockfile, `.nvmrc`, `scripts/ci-policy.mjs`, workflows | [Operations](../OPERATIONS.md), [launch gates](32-LAUNCH-ONBOARDING-AND-PRODUCTION-GATES.md) |
| Future commerce/licensing | existing commerce/license services and repositories | [Decisions](13-DECISION-REGISTER.md), [economics](52-PLAN-ECONOMICS-COMMISSION-AND-HOLDS.md), [licenses](54-LICENSE-MODELS-FORENSICS-AND-REVOCATION.md) |

For any area, find existing tests by filename and imported symbol; inspect all applicable
security and transaction boundaries. Public/private DTOs and current authority deserve
more context than cosmetic changes. Broader product research starts at the
[handbook introduction](00-README.md), not at legacy material.

[Source precedence](58-SOURCE-OF-TRUTH-AND-REPO-HANDOFF.md) governs current versus target.
[Workflow](60-AGENT-WORKFLOW.md) covers two agents, standards, checks and a reusable prompt.
[PROBLEMS](../PROBLEMS.md) is the single defect registry: read matching entries, not every
historical record. Do not treat dated test claims as validation of today's changes.
