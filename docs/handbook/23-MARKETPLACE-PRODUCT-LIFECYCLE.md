# 23. Marketplace и lifecycle продукта

> Статус: OWNER DECISION target specification. Текущий closed beta всё ещё не активирует реальные paid flows.

## 1. Initial commercial vertical

MTA NEXUS начинает marketplace с **MTA Scripts**. Архитектура не должна навсегда ограничиваться только scripts, но первый production commerce должен быть глубоко проработан именно вокруг этого типа цифрового продукта.

## 2. Product ownership

Любой зарегистрированный пользователь может стать seller через сам факт публикации коммерческого продукта и принятия Seller/Publishing Agreement. Отдельная обязательная seller application отсутствует. Verification — независимый evidence-based trust layer.

## 3. Product editions and delivery

Один продукт может иметь:

- Free edition;
- Premium edition;
- closed-code delivery;
- open-source delivery;
- несколько license scopes;
- bundle membership;
- source-code premium variant.

### Closed code

Seller выбирает:

- DRM enabled;
- DRM disabled.

### Open source

DRM отсутствует. Покупатель должен явно видеть, что получает source code и под какой license model.

## 4. Price

Seller сам задаёт цену. Product model не вводит искусственный minimum price, кроме технических/provider-specific ограничений платежей.

Цена не должна использоваться как trust signal.

## 5. Discounts

Поддерживаются:

- seller discounts;
- coupons;
- promo codes;
- platform campaigns;
- bundles.

UI обязан показывать реальную обычную цену/скидку без fake markdown pricing.

## 6. Product publication lifecycle

Рекомендуемый target lifecycle:

```text
DRAFT
  -> READY_FOR_CHECKS
  -> AUTOMATED_SAFETY_CHECKS
  -> MANUAL_REVIEW        (обычный plan)
  -> PUBLISHED

DRAFT
  -> READY_FOR_CHECKS
  -> AUTOMATED_SAFETY_CHECKS
  -> PUBLISHED            (subscription auto-publish capability)
```

Auto-publish означает bypass manual queue, но никогда не bypass malware/integrity/policy gates.

Дополнительные states:

- rejected;
- suspended;
- archived;
- retired;
- version deprecated.

## 7. Build/version lifecycle

Каждая версия хранит:

- immutable artifact identity;
- SHA-256/size;
- scan provenance;
- version number;
- changelog;
- compatibility/dependencies;
- publication/moderation history.

Changelog/version history является обязательной частью коммерческого listing.

## 8. Purchase lifecycle

```text
Product/SKU
  -> Order
  -> Payment intent
  -> Provider confirmation
  -> Purchase
  -> License/Entitlement
  -> Delivery
  -> Optional DRM activation/lease
  -> Update entitlement
  -> Review eligibility
  -> Optional dispute/refund
```

Ни один provider webhook не должен напрямую «магически» создавать доступ без idempotent domain transition.

## 9. Update entitlement

По умолчанию покупатель получает будущие обновления бесплатно.

Update flow не должен требовать новой покупки, если:

- это тот же product/SKU/license family;
- entitlement active;
- seller не изменил license scope через отдельную прозрачную migration policy.

## 10. Commission and settlement

- NEXUS commission: 10% от реально оплаченной суммы после скидки;
- PSP fee: provider-dependent;
- base payout hold: 7 days;
- hold может меняться по trust/subscription policy;
- seller не может делать untracked unilateral refund.

## 11. Seller analytics

Target dashboard включает:

- gross/net revenue;
- NEXUS commission;
- PSP fees where available;
- views;
- conversion;
- purchases;
- refunds/disputes;
- downloads;
- active licenses;
- version adoption;
- geography only at privacy-safe aggregation;
- support/response metrics where applicable.

## 12. Reviews

Paid product review требует confirmed purchase. Free product review требует confirmed claim/acquisition. Review можно обновить после новой версии, сохраняя историю/last-updated context, чтобы seller не мог «обнулить» старую обратную связь release'ом.

## 13. Refund/dispute relationship

Refund — не кнопка продавца «вернуть вне системы». Это audited operation, синхронизирующая:

- payment/refund state;
- commission;
- payout reserve;
- purchase;
- entitlement/license;
- DRM state where applicable;
- dispute decision;
- notifications/audit.

## 14. Non-goals for first commerce release

Не начинать с:

- custom crypto custody;
- самодельного wallet без legal/business need;
- сложного ad auction;
- dozens of unrelated digital categories;
- DRM that requires per-customer recompilation.

## 15. Round 5 — cart, license scope и post-sale access

### 15.1 Cart first

Target marketplace использует корзину. Минимальный lifecycle:

```text
Browse/Search
  -> Product/SKU
  -> Add to Cart
  -> Cart validation
  -> Order
  -> Payment
  -> Per-item Purchase
  -> Per-item License/Entitlement
  -> Delivery
```

Cart validation повторяется на сервере непосредственно перед payment intent: цена, availability, currency/provider compatibility, coupon, buyer eligibility и SKU state не доверяются client state.

### 15.2 License scope

DECISION: базовая commercial модель — **одна лицензия = один MTA server**.

Если один покупатель хочет использовать ресурс на нескольких серверах, он получает отдельные license units/purchases по policy, а не одну неограниченную server license по умолчанию.

Open-source purchase может иметь contract/license terms, но не DRM enforcement.

### 15.3 Demo / Trial

DECISION: paid resources могут иметь seller-enabled trial/demo. Trial не обязан существовать у каждого product.

Trial entitlement должен быть отдельным от Purchase и иметь собственные:

- срок;
- server binding where relevant;
- download/activation limits;
- DRM lease state where seller включил DRM;
- conversion path to paid license;
- anti-abuse controls.

### 15.4 Wishlist

DECISION: marketplace включает Wishlist. Пользователь может получать notifications о:

- discount;
- new version;
- availability/status change;
- переходе Free/Premium offer;
- seller announcement where opted in.

Wishlist не является purchase intent и не должна влиять на seller trust/reviews.

### 15.5 Support term

Seller может задавать срок included support: например 30/90/365 дней или другой policy-approved term. Это отдельное право от ownership/license и update entitlement.

Product page до покупки явно показывает:

- срок support;
- что входит в support;
- response expectations if seller заявляет SLA-like promise;
- куда обращаться через unified NEXUS support system.

### 15.6 Delist / seller-ban retention

OWNER DECISION: вечный redownload после delist **не гарантируется**. После добровольного снятия продукта или блокировки seller — 30-дневное окно доступа, кроме security/legal exceptions.

Нельзя скрывать это в мелком legal text. Buyer должен знать правило до оплаты.

### 15.7 Existing downloaded copies

NEXUS может прекращать hosting/download entitlement, но не заявляет технически невозможное «удаление» уже скачанных open-source/closed binaries у пользователя. DRM-protected runtime behavior определяется license policy отдельно.

## 16. Round 7 — publishing/KYC/archive clarifications

- Seller может создавать draft и готовить listing до KYC/provider onboarding.
- KYC/provider seller onboarding обязателен **до первой выплаты** и может потребоваться раньше, если этого требует PSP/legal model.
- Subscription auto-publish работает только при отсутствии active risk flags и может быть временно revoked staff.
- Seller может самостоятельно `Unlist` product.
- Permanent archive/takedown не удаляет purchase/audit history.
- Delisted/Archived product page остаётся доступной публично с reason/status и без purchase CTA, если legal/security policy не требует скрыть страницу полностью.