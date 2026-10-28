# MTA NEXUS — Consolidated Role Surface Map

> Статус: CONSOLIDATED TARGET MAP. Это мост к следующему screen-by-screen раунду, а не финальная IA каждого экрана.

## Guest

Доступ:

- Home;
- Discover;
- Servers;
- Market/product pages;
- Community/content;
- public profiles/organizations;
- archived/delisted transparency pages;
- guest cart.

Для действий — register/login + email verification.

## User / Community Member

Дополнительно:

- follows;
- comments/forum;
- Community Feed;
- messages;
- notifications;
- profile customization;
- wishlist;
- support;
- Security Center;
- Activity & Security Log.

## Buyer

Workspace surfaces:

- Cart/Orders;
- Purchased;
- Free;
- Trials;
- Licenses;
- Updates;
- Support;
- Invoices/receipts;
- Disputes;
- per-purchase detail.

## Seller / Creator

Workspace surfaces:

- Products;
- Publish Wizard;
- Builds/Releases;
- Sales/Revenue;
- Pending settlement;
- Seller Balance projection;
- Analytics;
- Reviews;
- Support;
- Disputes;
- Promotions;
- Subscription/auto-publish capability;
- KYC/provider onboarding status.

## Server Owner

Workspace surfaces:

- Live Status;
- History/Analytics;
- Page Builder;
- Join analytics;
- Team/co-owners;
- Ownership transfer;
- Incidents/Maintenance/Events;
- Recruitment/Applications;
- Community space;
- Reviews/Reputation;
- Promotion/Server subscription.

## Organization

Workspace surfaces:

- Members/Invites;
- Roles/Permissions;
- Servers;
- Resources;
- Content/Community;
- Billing/KYC;
- Payouts;
- Subscriptions;
- Support/Deals;
- Audit.

## Moderator / Trust

- case queues;
- reports/evidence;
- resource/server/content moderation;
- verification;
- SCAM/BLACKLIST;
- appeals;
- quarantine;
- public reason authoring;
- audit.

## Support

- unified support queue;
- purchase/product/server/org context;
- attachments/evidence;
- escalation to Trust/Finance/Security;
- user-visible communications.

## Finance

- normalized payments;
- orders/refunds/disputes;
- settlement/payout projections;
- provider reconciliation;
- restricted raw-provider debug capability;
- audit.

## Super Admin

Super Admin не должен работать «без правил». Он имеет cross-domain capabilities для emergency/maintenance/governance, но destructive production actions и real-payment activation остаются explicit human gates with audit.

## Screen specifications

This map is the authorization/role overview. Exact screen composition is defined in:

- Guest/Home/Discover: `44-GUEST-HOME-DISCOVER-SCREENS.md`
- User/Profile/Community: `45-USER-PROFILE-COMMUNITY-SCREENS.md`
- Buyer: `46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md`
- Seller: `47-SELLER-CREATOR-SCREENS.md`
- Server Owner: `48-SERVER-OWNER-SCREENS.md`
- Organization: `49-ORGANIZATION-SCREENS.md`
- Staff: `50-STAFF-OPERATIONS-SCREENS.md`
- Pricing/offline/errors: `51-PRICING-SUBSCRIPTIONS-ERROR-OFFLINE-UX.md`