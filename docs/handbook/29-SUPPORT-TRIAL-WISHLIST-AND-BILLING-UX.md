# 29. Support, Trial, Wishlist и Billing UX

## CURRENT support implementation — 2026-10-07

В `main` реализован первый end-to-end unified support slice:

- durable `support_cases` + participant message history;
- authenticated user create/list/thread/reply flow;
- staff queue under `/admin/support` for current moderator/admin capability model;
- staff reply, resolve, close and reopen;
- audit events for case creation, replies and status changes;
- dedicated rate limits for case/message spam;
- RU/EN user UI and mobile `More -> Support` access;
- public case creation intentionally does **not** accept arbitrary related purchase/license/product IDs until server-side ownership/context verification exists;
- no hard response-time promise during closed beta.

Пока **не** реализованы evidence attachments, seller/team routing, purchase/license auto-context, assignment/priority/SLA automation и отдельная Support staff capability. Current staff access временно использует `admin.moderation`, пока не внедрена broader many-to-many staff model.

## 1. Trial/demo

Paid seller может включить demo/trial.

Trial — отдельный entitlement, а не fake zero-price Purchase. Он может ограничиваться:

- временем;
- одним сервером;
- числом activation/download;
- урезанными feature flags;
- seller-enabled DRM lease;
- cooldown между повторными trials.

Trial conversion в purchase не должна терять выбранный server context без причины.

## 2. Wishlist

Wishlist — личный список интересующих ресурсов.

Target notifications:

- price reduction;
- active promotion;
- new stable version;
- product back/available;
- seller announcement if opted in.

Wishlist private by default unless user explicitly shares it in future.

## 3. Unified support

OWNER DECISION: поддержка строится как общая NEXUS support system.

Support case может быть связан с:

- purchase;
- license/activation;
- resource/build;
- seller;
- payment;
- dispute;
- server/product integration.

Seller/team отвечает внутри единой system. Staff может быть escalated по policy. Это лучше, чем потеря контекста в произвольных DMs.

## 4. Seller-defined support term

Product/SKU показывает included support duration. Seller может выбирать срок согласно allowed policy.

Support expiry не означает автоматическое удаление Purchase. UI отдельно показывает:

- product ownership/license;
- update entitlement;
- support entitlement;
- DRM state.

## 5. Billing display

Checkout показывает:

- authoritative price/currency;
- approximate local currency when conversion data available;
- tax/VAT;
- discount/coupon;
- final total;
- provider/payment method.

Approximate conversion всегда маркируется как estimate; provider settlement result — authoritative.

## 6. Seller settlement dashboard

Seller/Organization sees:

- gross sales;
- discount impact;
- platform 10% commission;
- provider fees when available;
- tax deductions where reported;
- pending;
- hold until date;
- available;
- paid;
- refunded;
- disputed/reserved.

Не использовать слово `wallet`, если это юридически/технически не wallet.

## 7. Receipts/invoices

Purchase history содержит provider-backed financial documents where available. Buyer может скачать/открыть их через authenticated history.

## 8. Tax provider preference

NEXUS предпочитает PSP/MoR/marketplace tax capabilities. Custom tax logic добавляется только после реальной business/legal необходимости и expert review.

## 9. support access and priority

Any registered user may open a pre-sale support question where the product/seller policy allows it. Buyer/claimer cases can attach purchase/license context automatically. Direct seller messaging remains a parallel communication surface; dispute evidence should stay in the structured case when a dispute exists.

A seller subscription may provide faster operational routing/support from NEXUS, but it must never alter moderation, verification or dispute outcomes.

OWNER DECISION: seller response time/support satisfaction is not a mandatory public reputation signal. It may remain private/internal analytics.

## 15. support/dispute evidence attachments

Support и dispute могут принимать evidence attachments:

- screenshots/images;
- plain text;
- logs;
- safe document formats;
- archives после malware scan и unpack/inspection policy.

Executables и явно опасные типы не должны становиться обычным DM/support attachment path. Для security investigation staff может существовать отдельный quarantined evidence channel с более строгими permissions.

Uploads должны иметь size/type limits, private-by-default storage, immutable evidence identifiers и audit trail при использовании в dispute/moderation case.
