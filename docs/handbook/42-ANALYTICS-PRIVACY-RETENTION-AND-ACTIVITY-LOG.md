# MTA NEXUS — Analytics, Privacy, Retention и Activity Log

> Статус: OWNER DECISION / TARGET SPEC, Round 7.

## 1. Analytics principle

NEXUS может собирать как видимые product metrics, так и невидимые в UI technical/behavior signals, если они нужны для:

- product analytics;
- attribution;
- fraud/abuse prevention;
- security;
- reliability.

`Hidden` не означает `secret from policy`: категории данных и цели должны быть раскрыты в Privacy/Cookie/analytics policy и подчиняться consent/legal requirements.

## 2. Join Server analytics

Owner-facing aggregates могут включать:

- click count;
- approximate unique sessions/users;
- source/referrer;
- campaign;
- timestamp buckets;
- first-party attribution identifiers;
- fraud-filtered counts.

Cross-site/third-party tracking не включается автоматически. Если он когда-либо нужен, требуется отдельная legal/privacy/consent оценка.

## 3. Data minimization

Не собирать «на всякий случай» raw player identity/telemetry, hardware fingerprint или unrelated browsing data только ради более красивого dashboard.

Security/fraud telemetry отделяется от marketing personalization по purpose, permissions и retention.

## 4. Record-specific retention

OWNER DECISION: нет единого срока хранения для всех данных.

Retention matrix задаётся по типу:

- authentication/session security;
- audit/moderation;
- payment/accounting/tax;
- disputes/chargebacks;
- malware/security evidence;
- support attachments;
- analytics;
- public content;
- archived/deleted accounts.

Срок = минимально необходимый для legal, accounting, fraud, security и product operation целей.

## 5. User Activity & Security Log

Пользователь видит important account events:

- login/session creation/revocation;
- password/email/2FA changes;
- recovery events;
- purchases/refunds/disputes;
- license binding/transfer/activation;
- server/org ownership changes;
- critical role/permission changes;
- security alerts.

Log не должен раскрывать внутренние anti-fraud rules или чувствительные staff notes.

## 6. Internal audit vs user log

Internal audit обычно богаче user-facing log. Это разные projections одного authoritative event history.

Пользовательский log оптимизирован на понятность и security awareness; staff audit — на расследование, attribution и compliance.