# Organization — Screen Specification

Status: **OWNER-CONFIRMED / TARGET**

## 1. Context switching

The single `/workspace` supports an active actor context.

Switching to an Organization changes organization-scoped areas together:

- Resources;
- Servers;
- Billing;
- Payouts;
- Support;
- Deals;
- Members/permissions;
- Audit.

Personal context remains separately accessible.

## 2. Organization Overview

Default overview includes:

- member count / pending invites;
- owned servers;
- owned resources;
- active subscriptions;
- revenue / payout status;
- open support/deals;
- recent audit events;
- high-risk/action-required notices.

## 3. Members and permissions

Provide templates:

`Owner / Admin / Developer / Support / Finance / Content`

Templates are shortcuts over a granular capability engine. Organization and server team authorization should share the same underlying capability concepts.

Critical actions require re-authentication and audit, including:

- ownership transfer;
- payout destination changes;
- Finance-rights assignment;
- destructive/permanent actions.

## 4. Finance

Finance is a **separate visual and permission-wise section**.

It may include:

- balance summary;
- pending/available/paid;
- payouts;
- provider state/KYC;
- orders/refunds/disputes associated with organization sales;
- invoices/receipts;
- subscription billing.

Ordinary developers/support members do not receive finance access by implication.

## 5. Public organization storefront / portfolio

Required public surface combining:

- organization identity;
- team members selected for public display;
- resources;
- servers;
- articles/content;
- reviews/reputation signals;
- verified external links.

## 6. Invites

Support both:

- personal invitations;
- invitation links with expiry and maximum uses.

## 7. Billing actor

Organization has its own billing profile and can own commercial resources and receive seller payouts as an entity, subject to payment-provider/legal capabilities.