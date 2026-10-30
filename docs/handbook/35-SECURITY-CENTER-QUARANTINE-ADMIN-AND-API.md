# MTA NEXUS — Security Center, Quarantine, Admin Search и API Policy

> Статус: OWNER DECISION / TARGET SPEC.

## 1. Security Center

MTA NEXUS должен иметь отдельный Security Center пользователя.

Минимальный target scope:

- active sessions;
- recognized devices / session metadata;
- login history;
- password/security events;
- 2FA setup and recovery codes;
- session revoke;
- suspicious-login/security alerts;
- future API credentials, если эта capability будет запущена;
- account recovery state.

CURRENT schema уже содержит security-related primitives, но эта глава описывает target UX, а не утверждает, что весь Security Center уже реализован.

## 2. 2FA policy

OWNER DECISION: 2FA **не является обязательной только из-за роли** Seller, Server Owner, Organization Finance или Staff.

Однако:

- интерфейс должен настойчиво рекомендовать 2FA для high-value/high-risk accounts;
- отдельный PSP/provider или security incident может требовать step-up authentication;
- sensitive actions могут запрашивать re-authentication независимо от наличия 2FA;
- платформа может пересмотреть mandatory-2FA policy позже при реальных abuse data.

Не блокировать базовую роль только потому, что пользователь не включил 2FA, если иной policy/legal/provider gate этого не требует.

## 3. Global admin/case search

Административный интерфейс должен иметь permission-aware global search, способный искать связанные дела и сущности по:

- User ID / vanity username;
- Server ID / endpoint;
- Resource/Product/Build ID;
- Order / Order Item;
- Payment/provider reference;
- License/entitlement;
- dispute/case/report ID;
- IP/technical indicator where staff permission and retention policy allow;
- audit event ID.

Search result должен показывать связи между сущностями, но не раскрывать finance/security data staff без соответствующей capability.

## 4. Raw payment/provider data

OWNER DECISION: Finance staff по умолчанию работает с **normalized payment model**.

Raw provider payload:

- не показывается всем finance/moderation staff;
- доступен через отдельный restricted debug capability;
- каждое открытие raw payload желательно audit-log;
- secrets/signatures/full card/bank data не должны попадать в UI, если provider вообще прислал такие поля;
- retention/redaction следует provider/legal/security policy.

## 5. Quarantine

Нужен отдельный state/action `Quarantine` для подозрительного resource/build.

Quarantine должна немедленно останавливать новые risk-bearing действия:

- download;
- activation/lease issuance for affected build where applicable;
- promotion/featured placement;
- automatic publication/rollout.

При этом артефакт не удаляется физически автоматически. Он сохраняется как evidence с ограниченным staff access, audit trail и reason.

Quarantine отличается от permanent rejection/takedown и может быть снята после проверки.

## 6. Malware response

При подтверждённом malware/security incident платформа должна уметь определить пользователей, которые получили affected build, и уведомить их.

Notification минимум содержит:

- affected product/build/version;
- severity/status;
- что нужно сделать: stop/remove/update;
- ссылку на безопасную replacement version, если есть;
- timestamp решения;
- support/security contact;
- transparency reason, если публикация причины не создаёт дополнительный риск.

Нельзя ограничиваться удалением build из каталога: downstream exposure уже скачавших пользователей является отдельной incident-response задачей.

## 7. API keys и webhooks

OWNER DECISION: self-service API keys/webhooks **не являются обязательным требованием первой commercial release**.

Предыдущие решения о возможной ценности API/webhooks в Server Pro/Creator Pro считаются долгосрочной target capability, а не launch blocker.

Когда capability будет вводиться, она должна иметь:

- scoped credentials;
- rotation/revocation;
- audit;
- rate limits;
- explicit webhook signing;
- event versioning;
- least-privilege permissions;
- separation personal/org credentials.

## 8. Public API policy

Утверждённая граница внешнего API: **на первом этапе не открывать анонимный read-only API всему интернету; API при появлении сначала предназначен только authenticated partners/Pro/integrations**.

Следовательно:

- open anonymous public API — не launch requirement;
- authenticated partner/Pro API — допустимое future направление;
- текущие internal APIs не считать public compatibility contract;
- scraping не должен становиться неофициальной заменой API contract;
- public developer platform можно открыть позже отдельным owner decision.

## 9. Platform status page

OWNER DECISION: отдельная публичная Status Page самой NEXUS **не требуется** как target feature сейчас.

Это не означает отказ от internal observability, alerts и incident response. Production всё равно требует мониторинг и operational incident records.

## 10. Security invariants

- subscription никогда не ослабляет quarantine/malware decisions;
- finance access не даёт moderation access автоматически;
- raw provider data является restricted surface;
- staff search permission-aware;
- audit events неизменяемы приложением без специальной maintenance procedure;
- security actions должны быть server-authoritative;
- malware/takedown decisions должны распространяться на cached/private delivery paths, а не только скрывать UI card.

## 11. sensitive action policy

Security-sensitive operations должны поддерживать step-up/re-authentication независимо от optional 2FA policy. Это относится как минимум к ownership/payout/finance privilege changes и другим действиям, определённым risk model.

OWNER DECISION сохраняется: 2FA не является принудительной только по факту роли, но Security Center обязан поддерживать 2FA, recovery и session management.

User-facing Activity & Security Log является target feature и описан отдельно в `42-ANALYTICS-PRIVACY-RETENTION-AND-ACTIVITY-LOG.md`.
