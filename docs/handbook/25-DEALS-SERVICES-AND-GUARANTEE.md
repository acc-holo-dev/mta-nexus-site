# 25. Services, Deals и Guarantee

> Статус: target commercial specification. Это финансово/юридически чувствительный контур и требует provider/legal validation перед production activation.

## 1. Purpose

NEXUS продаёт не только готовые MTA Scripts. Пользователи могут заказывать custom development/services, а платформа предоставляет структурированный Deal/Guarantee flow.

## 2. Actors

- Client / Buyer;
- Contractor / Seller;
- NEXUS dispute staff;
- Payment provider;
- optional Organization on either side.

## 3. Deal lifecycle

```text
DRAFT
  -> PROPOSED
  -> ACCEPTED
  -> FUNDED / PROVIDER_SECURED
  -> IN_PROGRESS
  -> DELIVERY_SUBMITTED
  -> ACCEPTED -> SETTLEMENT_PENDING -> COMPLETED
                    \
                     -> DISPUTED -> REVIEW -> RESOLVED
```

Exact provider states can differ; domain states remain stable.

## 4. Deal specification

До оплаты стороны фиксируют:

- scope;
- deliverables;
- price/currency;
- deadlines/milestones;
- license/source-code terms;
- DRM requirement if relevant;
- communication/evidence policy;
- acceptance criteria;
- refund/dispute rules.

Изменение существенных условий после funding требует explicit amendment accepted обеими сторонами.

## 5. Guarantee principle

NEXUS должен по возможности использовать marketplace/split/escrow-like provider capabilities, а не превращаться в самодельный банк/кошелёк.

Цель guarantee:

- клиент не платит исполнителю окончательно до fulfilment milestone;
- исполнитель видит, что деньги действительно secured согласно provider state;
- dispute staff имеет evidence trail;
- settlement follows decision.

## 6. Evidence

Разрешённые evidence types могут включать:

- platform messages;
- attached files;
- delivery artifacts;
- Git commits/repository references;
- screenshots/logs;
- agreed milestones;
- acceptance/rejection messages.

PII/secrets должны быть минимизированы.

## 7. Dispute

Internal dispute решает authorized NEXUS staff. Bank/PSP chargeback — отдельный external process.

Decision options:

- full buyer refund;
- full seller settlement;
- partial settlement/refund if provider supports it;
- revised delivery window by agreement;
- enforcement/sanctions for fraud/abuse.

## 8. Commission

Default platform commission philosophy остаётся 10% successful marketplace transaction. Exact service/deal fee policy может включать отдельные plan-dependent terms только после явного pricing decision.

## 9. Reviews

После completed deal обе стороны могут получить eligibility на verified service review. Review не должен раскрывать private source code, secret business terms или private evidence.

## 10. Abuse controls

Нужны:

- anti-collusion/fake deal detection;
- duplicate/fraud payment checks;
- rate limits;
- suspicious account holds;
- staff audit;
- appeal rights;
- transparent enforcement reasons.