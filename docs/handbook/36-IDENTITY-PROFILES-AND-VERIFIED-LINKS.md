# MTA NEXUS — Identity, Public Profiles и Verified Links

> Статус: OWNER DECISION / TARGET SPEC.

## 1. Primary identity

Каждый аккаунт имеет неизменяемый внутренний/public-stable **User ID**. Он является главным identity anchor и не зависит от подписки, vanity naming или оформления профиля.

OWNER DECISION: обычный пользователь изначально может существовать публично под ID. Подписка может открыть возможность добавить **vanity username**.

## 2. Vanity username

Vanity username — платная customization/discovery capability, а не отдельная identity.

Правила target:

- User ID остаётся immutable;
- username не должен заменять ID в audit/security/payment relations;
- username должен быть unique и проходить reserved-name/impersonation checks;
- username не даёт verification;
- username не позволяет копировать staff/verified visual identity;
- изменение уже выбранного vanity username допускается как **отдельная платная операция**;
- после окончания entitlement действует **7-дневный grace/reservation**, после чего slug освобождается;
- потеря vanity entitlement никогда не разрушает immutable identity/audit history.

## 3. Public profile default

OWNER DECISION: профиль нового пользователя по умолчанию **публичный**.

Public-by-default не означает раскрытие private data. По умолчанию допустимы только специально предназначенные для публичного профиля поля:

- public ID / vanity username;
- avatar/banner;
- bio;
- badges/verification;
- public organizations;
- public resources;
- public servers;
- selected achievements;
- public posts/activity where policy allows;
- verified external links.

Никогда автоматически не публиковать email, payment history, private purchases, IP/device/session data, moderation evidence или private organization membership.

## 4. Profile customization

Профиль может поддерживать:

- avatar;
- banner;
- bio;
- social/external links;
- portfolio;
- showcase resources/servers;
- achievements;
- activity;
- Pro themes/customization.

Customization не должна позволять имитировать trust badges, staff UI, warning banners или SCAM/verification labels.

## 5. Verified external links

OWNER DECISION: нужны подтверждённые внешние связи.

Возможные verified link types:

- GitHub;
- Discord;
- website/domain;
- other supported developer/community identities.

Verification означает только доказанное владение внешней точкой, а не endorsement качества пользователя.

## 6. Verification methods

Метод зависит от provider:

- OAuth/account proof where available;
- DNS TXT / domain challenge;
- signed/tokenized file/page challenge;
- provider-specific bot/interaction challenge.

Не просить пользователя публиковать secrets/API tokens в profile.

## 7. Anti-impersonation

Identity/trust UI должен всегда позволять отличить:

- immutable User ID;
- vanity username;
- verified external account;
- platform verification badge;
- staff status;
- organization identity.

Search/admin tools должны уметь находить пользователя по immutable ID даже если vanity presentation когда-либо изменится по будущей policy.

## 8. Subscription boundary

Можно монетизировать:

- vanity username;
- additional themes;
- extra showcase blocks;
- media/customization;
- professional presentation tools.

Нельзя монетизировать как cosmetic purchase:

- Verified Seller/Developer;
- Verified Server/Organization;
- Clean Build;
- staff status;
- SCAM removal;
- review authenticity.

## 9. authentication и social identity boundary

OWNER DECISION:

- основной способ входа — **email/password**;
- social networks не являются login providers на данном этапе;
- Discord/GitHub/Google/website и другие внешние identities могут использоваться как verified links/identity evidence;
- OAuth или provider-specific challenge допустимы внутри процедуры **подтверждения владения внешним аккаунтом**, но не должны автоматически становиться альтернативным способом входа;
- verified external identity не равна platform verification и не даёт Seller/Staff/Trusted status.

## 10. Email verification

Практически все state-changing public действия требуют подтверждённого email:

- comments/forum/content authoring;
- follows;
- free resource claim;
- trial;
- purchase/checkout completion;
- resource publishing;
- server claim;
- DMs/support submissions;
- organization/server invitations and ownership-sensitive actions.

Гость и unverified account могут читать разрешённые public surfaces. Исключения для recovery/support/security должны проектироваться явно и не превращать email verification в deadlock.

## 11. Vanity lifecycle

Target semantics:

1. identity всегда anchored на immutable User ID;
2. активная eligible subscription/entitlement может открыть vanity username;
3. выбор username проходит uniqueness/reserved/impersonation checks;
4. смена username — **отдельная платная операция**;
5. после окончания username entitlement действует **7-дневный grace/reservation**;
6. если entitlement не восстановлен за 7 дней, публичный slug освобождается;
7. historical audit/payment/moderation references никогда не переписываются под новый username;
8. staff search всегда работает по immutable ID и хранит historical presentation values как evidence/audit metadata там, где это необходимо.
