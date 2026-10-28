# Guest, Home and Discover — Screen Specification

Status: **OWNER-CONFIRMED / TARGET**  

## 1. Purpose

The public shell must let a person understand MTA NEXUS before creating an account. Browsing is public; account creation is required only when the visitor performs an action that mutates state.

Primary public navigation remains:

`Home / Servers / Market / Community / Messages / Notifications / Workspace/Profile`

For a guest, protected destinations redirect to authentication while preserving return intent.

## 2. Home `/`

### 2.1 Hero

The first viewport contains:

- one large global search entry point;
- a concise live ecosystem summary;
- primary contextual links to Servers, Market, Community and Events;
- no permanent registration wall.

The hero search is not a command palette. It performs ordinary search/navigation only.

### 2.2 Trending now

`Trending now` is an approved Home module.

Rules:

- it is a discovery surface, not the sole canonical ranking of the ecosystem;
- the reason for trend placement should be explainable from recent activity signals;
- sponsored inventory must never silently occupy organic trend positions;
- manipulation/fraud signals can suppress or quarantine an entity from the module.

### 2.3 Home modules

Recommended order for the default guest Home:

1. Hero + global search.
2. Trending now.
3. Live / notable servers.
4. Marketplace highlights.
5. Community highlights.
6. Upcoming or active events.
7. Trust/safety or ecosystem notices when relevant.

Home uses finite sections with `Show more`; it is not an infinite feed.

### 2.4 Contextual CTAs

Cards use the action appropriate to the entity:

- server: `View server`, `Join`;
- resource: `View`, `Add to cart`, `Get free`;
- creator/person: `View profile`, `Sign in to follow`;
- community item: `Open discussion`, `Sign in to react`;
- event: `View event`.

Do not replace normal browsing with repetitive `Create account` banners.

## 3. Discover `/discover`

### 3.1 No mixed result stream

Owner decision: **do not use a mixed all-entity result feed**.

Discover uses explicit entity tabs/sections such as:

- Servers
- Resources
- People
- Organizations
- Content
- Events

An `All` tab that interleaves heterogeneous cards is not part of the required design.

### 3.2 Filters

Each entity tab receives filters meaningful to that entity. Filter vocabularies must not be forced into one universal schema.

Examples:

- Servers: status, locale, online range, verified, tags, activity.
- Resources: free/paid, source model, DRM, category, rating, update recency.
- People: verification/badges, creator/server roles, activity.
- Organizations: type, verified state, resources/servers presence.
- Content: content type, recency, author/entity association.
- Events: time window, organizer/entity, status.

## 4. Guest state and auth boundary

Guest may read all public surfaces. Auth is requested for state-changing actions, including follow, comment, post, claim, trial, purchase completion, DM and account-specific personalization.

A guest may build a cart. Checkout completion requires authentication, verified email and server-authoritative revalidation.

## 5. Responsive behavior

Desktop retains sidebar/top navigation. Mobile uses bottom navigation:

`Home / Servers / Market / Community / More`

`More` surfaces Messages, Notifications, Workspace/Profile and secondary destinations.

## 6. Accessibility and failure states

Key Home/Discover flows target WCAG 2.2 AA. Production errors expose a support-safe correlation/request ID and never a stack trace.