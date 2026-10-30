# MTA NEXUS — Account, Authentication и Lifecycle

> Статус: OWNER DECISION / TARGET SPEC.

## 1. Guest boundary

Без аккаунта пользователь может читать все разрешённые public surfaces:

- Home / Discover;
- public Servers;
- Resources/Market listings;
- public User/Organization profiles;
- public Community topics/articles/events;
- archived/delisted pages, если они не скрыты security/legal policy.

Login нужен для state-changing actions. Это сохраняет NEXUS открытым как источник информации, но не позволяет анонимно изменять trust/community/commercial state.

## 2. Authentication

Основной login method: **email + password**.

Social accounts не являются login providers на этом этапе. Их можно подтверждать как external identities.

Required account security primitives:

- secure password hashing;
- email verification;
- password reset/recovery;
- session listing/revocation;
- optional 2FA;
- recovery codes where 2FA enabled;
- sensitive-action re-authentication;
- rate limits/abuse prevention;
- Activity & Security Log.

## 3. Email verification gate

Подтверждение email обязательно для большинства действий кроме чтения и базового account recovery:

- follow;
- comment/forum/content submission;
- DM/support;
- free claim/trial;
- checkout/purchase;
- resource publish;
- server claim;
- organization/server invites and ownership changes.

## 4. Account deletion

OWNER DECISION: пользователь не обязан вручную обходить все сущности и передавать каждую перед deletion. Система сама переводит personal-owned сущности в безопасное **archive/inactive state** там, где это применимо.

Rules:

- personal draft/resources/server-owned surfaces без alternate owner архивируются;
- co-owned/organization entities не должны уничтожаться из-за удаления одного участника; ownership resolution использует remaining owners/policy;
- active deals/payment/disputes не исчезают — они переходят в controlled closure/retention flow;
- audit/security/payment/legal records сохраняются на необходимый срок;
- public profile становится deleted/archived identity presentation;
- username entitlement освобождается согласно vanity policy;
- private personal data удаляется/анонимизируется там, где retention obligation не требует хранения.

Deletion — workflow, а не каскадный `DELETE FROM users`.

## 5. Vanity username lifecycle

Identity anchor = immutable User ID.

Vanity username:

- доступен в рамках paid eligible entitlement/subscription;
- unique;
- проверяется на impersonation/reserved names;
- после окончания entitlement освобождается;
- смена username — отдельная платная операция;
- не переписывает historical audit/payment/moderation references.

## 6. No data-export product requirement

OWNER DECISION: отдельная пользовательская функция `Export my data` сейчас **не является product requirement**.

Это не отменяет обязательств по privacy law/access requests в юрисдикциях, где они применимы. Legal compliance process может существовать без self-service export UI.

## 7. Account archival states

Рекомендуемая domain модель:

```text
ACTIVE
  -> SUSPENDED
  -> DELETION_REQUESTED
  -> ARCHIVING
  -> ARCHIVED/DELETED_PRESENTATION
```

Financial/legal/security holds могут задерживать физическое удаление отдельных data records, но не должны сохранять лишние данные бессрочно.
