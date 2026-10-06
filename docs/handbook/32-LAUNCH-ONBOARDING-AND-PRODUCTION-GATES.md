# 32. Launch, Onboarding и Production Gates

## 1. Public launch model

OWNER DECISION: первый настоящий публичный launch target — **Open Beta для всех**, а не invite-only/staged creator launch.

Это означает public accessibility, но не означает одновременную активацию всех paid features.

## 2. One Home architecture

Guest и authenticated user используют одну structural Home:

- global search;
- live server discovery;
- resources/marketplace;
- community/content;
- events/news;
- trust/safety visibility.

Authenticated state adds:

- follows;
- personalized modules;
- notifications;
- own servers/resources/org shortcuts;
- relevant purchases/support.

## 3. Registration onboarding

Wizard is lightweight and editable later:

1. language;
2. interests;
3. favorite/interesting servers;
4. resource categories;
5. intended activities;
6. notification channels/preferences.

No irreversible role assignment.

## 4. Navigation rule

No target command palette / command-driven UX. Use clear navigation, dedicated search and contextual actions.

## 5. Open Beta gate

Before opening to everyone, at minimum:

- registration/recovery/email flow works;
- abuse/rate limits active;
- live server directory stable enough;
- resource safety invariant enforced;
- moderation/report workflows staffed/usable;
- backup/restore rehearsed;
- observability/alerts available;
- Terms/Privacy/Community rules published;
- support/escalation path exists;
- production secrets/TLS/storage configured;
- rollback/recovery runbook tested.

## 6. Real-payment production gate

Real payment activation is a separate, stricter human gate. Required before processing real money:

- legal/business entity and jurisdiction model;
- PSP/MoR/marketplace provider contracts;
- seller onboarding/KYC policy;
- Seller/Publishing Agreement;
- Terms of Service;
- Privacy Policy;
- Refund/Dispute Policy;
- tax/VAT/accounting design;
- commission/fee disclosure;
- payout/hold policy;
- chargeback reconciliation;
- financial audit/event trail;
- backup/restore verification;
- security review/threat model;
- incident response;
- provider webhook/idempotency tests;
- test/sandbox end-to-end settlement;
- at least one controlled real settlement/refund acceptance run where legally/provider permitted;
- explicit human production approval.

## 7. Feature flags

Open Beta can run with:

- free resources active;
- server/community active;
- paid marketplace UI hidden or read-only;
- seller onboarding disabled;
- production payment credentials absent.

Never simulate a successful real payment path to users.

## 8. Launch success model

Owner chose ecosystem-wide success, so dashboards should observe together:

- active users/returning users;
- active/claimed servers;
- active creators/sellers;
- safe resources published;
- community activity;
- meaningful time/retention;
- GMV/revenue when commerce enabled;
- disputes/refunds/chargebacks;
- moderation/safety load;
- platform reliability.

## 10. Round 7 — release experience gates

OWNER DECISION: к публичному release target должны войти не только responsive pages, но и product-quality requirements:

- installable PWA;
- offline shell для безопасных non-transactional surfaces;
- Web Push capability;
- Light / Dark / System themes;
- WCAG 2.2 AA target для ключевых account/commerce flows;
- mobile bottom navigation;
- user Activity & Security Log;
- email notifications.

Telegram/Discord bots **не являются release requirement**. Они требуют отдельной bot/integration инфраструктуры и отложены.

PWA offline mode никогда не должен симулировать успешные state-changing actions: purchase, license transfer, moderation, publish, ownership changes и finance требуют authoritative online confirmation.