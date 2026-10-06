# MTA NEXUS — Seller Publishing, KYC и Catalog States

> Статус: OWNER DECISION / TARGET SPEC, Round 7.

## 1. Publish Wizard

Target wizard:

1. Basic Info;
2. Delivery Model;
3. Files / Source;
4. Dependencies;
5. Media;
6. Price / SKU;
7. DRM;
8. Support;
9. Preview;
10. Submit / Auto-publish.

Wizard должен сохранять draft по шагам и позволять безопасно вернуться позже.

## 2. Seller eligibility

Любой обычный account может двигаться к продаже. Verified Seller не является входным билетом.

Для paid commerce:

- draft/listing preparation разрешено до KYC;
- KYC/provider onboarding нужен до первой payout;
- provider/legal rules могут потребовать KYC до acceptance real payment — implementation обязан уважать это;
- seller должен принять Seller/Publishing Agreement до first paid publication/transaction согласно legal gate.

## 3. Manual moderation and subscription auto-publish

Base flow: product проходит moderation.

Subscription capability может убрать ожидание ручной очереди, но никогда не отключает:

- malware scan;
- integrity/hash checks;
- prohibited-content/policy automation;
- storage safety;
- DRM/package validation where relevant;
- risk engine.

Auto-publish доступен только при отсутствии active risk flags. Authorized staff может временно/постоянно revoke capability с reason/audit/appeal where policy allows.

## 4. Catalog states

Рекомендуемые states:

```text
DRAFT
PENDING_REVIEW
PUBLISHED
UNLISTED
QUARANTINED
SUSPENDED
ARCHIVED
TAKEDOWN
```

`UNLISTED` seller может включить сам.

`ARCHIVED/TAKEDOWN` сохраняют:

- purchase history;
- license/entitlement history;
- build/version history;
- moderation/audit;
- dispute/support references.

## 5. Public archived page

Если нет legal/security запрета, archived/delisted product page остаётся публичной и показывает:

- status;
- substantive reason;
- seller identity/history where allowed;
- latest safe metadata;
- no purchase CTA;
- buyer support/access guidance.

Это лучше 404 для trust, старых links и истории покупок.

## 6. Team permissions

Organization `manage_products` capability может разрешать:

- edit metadata;
- upload builds;
- releases;
- support;
- moderation responses.

Payout destination, billing identity, tax/provider settings доступны только Owner/Finance capabilities и требуют stronger re-auth/audit policy.