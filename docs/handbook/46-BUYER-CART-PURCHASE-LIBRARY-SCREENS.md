# Buyer, Cart, Purchase and Library — Screen Specification

Status: **OWNER-CONFIRMED / TARGET**

## 1. Buyer Workspace landing

Buyer landing prioritizes actionable ownership state:

1. recent purchases;
2. licenses waiting for server activation;
3. available product updates;
4. support/dispute alerts;
5. wishlist price/update changes;
6. recent invoices/receipts where provider-supported.

## 2. Cart `/cart`

The marketplace uses a real multi-item cart.

Each line item shows:

- resource / selected SKU;
- source model (`Open Source` or `Closed Source`);
- DRM state for closed-source SKU when seller enabled it;
- seller;
- price/discount;
- optional target MTA server selector;
- dependency or bundle warnings;
- removal control.

Choosing target server in cart is allowed but not required. Final eligibility is revalidated server-side before license binding/activation.

Guests may populate cart; payment completion requires authenticated verified account.

## 3. Checkout

Checkout is provider-abstracted. User sees:

- line items and final discounted price;
- NEXUS commission disclosure where relevant to seller-facing terms, not as a surprise buyer surcharge unless product policy requires it;
- approximate local-currency display when possible;
- actual settlement currency;
- applicable provider/tax/receipt disclosures;
- seller terms/licenses;
- refund/dispute policy.

## 4. License activation deadline

Default paid model: `1 license = 1 MTA server`.

Binding happens after purchase unless a server was preselected. An unbound paid license must be activated within **30 days**.

Notification cadence: **7 / 3 / 1 days** before expiry of the activation window.

The deadline applies to activation eligibility, not to the contractual term of a license already activated.

## 5. Buyer Library `/workspace/library`

Sections:

`Purchased / Free / Trials / Licenses / Updates / Support / Invoices`

Every item exposes current availability and reason when restricted.

## 6. Purchase detail

Owner-approved tab layout:

`Overview / Downloads / License / Updates / Support / Invoice / Dispute`

### Overview
- order/purchase identity;
- seller/product/SKU;
- purchase date and amount;
- entitlement status;
- server binding state;
- key alerts.

### Downloads
- eligible build/version;
- SHA-256;
- scan state/provenance;
- signature/integrity metadata when available;
- 30-day post-delist access rules where applicable.

### License
- server binding;
- activation state;
- contractual term;
- DRM lease/grace state where applicable;
- transfer policy.

### Updates
- version history/changelog;
- free future updates under current owner decision;
- compatibility/dependency changes.

### Support
- unified support thread/tickets;
- safe attachments.

### Invoice
- receipt/invoice/provider references where supported.

### Dispute
- eligibility/state/evidence/timeline and decision.

## 7. Trials

Seller may offer trials. Trial binds to one server, is short-lived and may have transfer/activation limits. Trial rights must be visibly distinct from paid ownership.

## 8. Offline/PWA behavior

Offline shell may display cached library metadata but must block payment, license activation/transfer and other state-changing commerce actions with a clear `Offline` state.