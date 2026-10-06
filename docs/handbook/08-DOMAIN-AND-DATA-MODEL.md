# MTA NEXUS — доменная и data-модель

> Статус: handbook v0.1.  
> Этот документ объясняет смысл сущностей. Схема БД в `packages/db/src/schema.ts` и migrations остаются техническим источником истины.

## 1. Главная идея модели

MTA NEXUS строится вокруг **единой identity** и связанных с ней объектов экосистемы.

Пользователь не создаёт отдельные аккаунты «игрок», «разработчик», «владелец сервера» или «модератор». Один User получает разные capabilities и contexts.

Базовая концептуальная граф-схема:

```text
User
 ├─ Sessions
 ├─ Organizations / Memberships
 ├─ Servers
 │   ├─ Observations
 │   ├─ Claim Challenges
 │   ├─ Content
 │   └─ Verification
 ├─ Products (Resources)
 │   ├─ Builds
 │   ├─ Claims/Entitlements
 │   ├─ Licenses
 │   ├─ Reviews/Comments
 │   └─ Content
 ├─ Follows
 ├─ Notifications
 ├─ Reports
 └─ Verification Requests

Platform
 ├─ Audit Events
 ├─ Moderation Cases
 └─ Commerce tables (present, paid flow disabled in current beta)
```

---

## 2. User

### CURRENT

User — базовая platform identity.

Основные поля/смыслы:

- username;
- email;
- password/auth data;
- display/avatar/bio;
- global role;
- verification flags;
- two-factor capability field;
- active context.

Текущие global role strings:

```text
user
developer
server_owner
moderator
admin
```

### Важно

Role — не единственный источник прав.

Authorization также зависит от:

- ownership;
- organization membership;
- organization permission set;
- target state;
- current context;
- moderation/admin policy.

---

## 3. Session

Session представляет активный authenticated access.

Модель должна поддерживать:

- создание;
- проверку;
- expiry;
- отзыв конкретной сессии;
- отзыв других сессий;
- безопасную password/recovery логику.

### Trust rule

Пользователь должен понимать, где он авторизован, и иметь возможность прекратить доступ другой сессии.

---

## 4. Organization

Organization — коллективный owner/context для:

- ресурсов;
- контента;
- потенциально серверов;
- будущих команд разработчиков.

### OrganizationMember

Текущие membership roles:

```text
owner
admin
developer
member
```

Также существует массив granular permissions.

### Принцип

Organization ownership не должно «протекать» через старого автора. После изменения membership доступ определяется текущими отношениями.

---

## 5. Server

Server — одна из центральных сущностей NEXUS.

### Основные группы данных

**Editorial:**

- name;
- slug;
- description/branding;
- links;
- visibility;
- owner/organization.

**Operational/current:**

- endpoint identity;
- current observation;
- online/player information;
- last observed time.

**Governance:**

- status;
- ownership/claim state;
- verification.

### Current status values в схеме

```text
active
inactive
maintenance
suspended
```

### Visibility

```text
public
unlisted
private
```

---

## 6. ServerObservation

ServerObservation — immutable/bounded observation, полученное NEXUS из внешнего MTA source.

Цель:

- отделить live evidence от ручного описания владельца;
- хранить временную историю;
- строить server intelligence без подделки данных.

Типичный смысл:

- source;
- timestamp;
- name/game mode;
- players/max players;
- другие разрешённые public fields.

### Future potential

На базе observations можно строить:

- uptime-like history;
- peak/average trends;
- change timeline;
- anomaly detection;
- watchlists.

Но метрика должна честно отражать качество source и gaps.

---

## 7. ServerClaimChallenge

Challenge связывает:

- конкретный server;
- requester;
- временный proof token digest;
- expiry;
- consumed/revoked state;
- captured source evidence;
- verification request.

### Инварианты

- token хранится через digest;
- один активный challenge на server/requester;
- consumed и revoked не одновременно;
- verification evidence появляется только после успешного consumption;
- proof version фиксирован/валидируется.

---

## 8. Product / Resource

В интерфейсе продуктовая сущность в первую очередь означает MTA resource.

### Current fields

- title;
- slug;
- description;
- short description;
- product type;
- author;
- optional organization;
- status;
- tags;
- currentVersion;
- ratings;
- sales/claim counters;
- price/currency/licenseModel fields, исторически сохранённые в модели.

### Current lifecycle

```text
draft
-> pending_review
-> published
-> suspended / archived
```

### Важное ограничение closed beta

Даже если таблица содержит `price`, current public resource flow разрешает бесплатную модель. Наличие поля не является разрешением включить платную коммерцию.

---

## 9. ProductType

Типы централизованы в `packages/domain`.

### Принцип

Новый тип нельзя «просто строкой» добавить в UI.

Изменение должно охватывать:

- domain registry;
- validation;
- database constraint/migration;
- localized labels;
- filters;
- creation UI;
- tests.

---

## 10. Build

Build — версия бинарного/архивного артефакта Resource.

### Current state family

```text
draft
testing
pending_review
published
rejected
deprecated
retired
```

### Core fields

- productId;
- version;
- release notes;
- storage key;
- size;
- SHA-256;
- scan status;
- scanner identity;
- scannedAt;
- moderator/review notes as applicable.

### Safe publication invariant

Published build обязан иметь trusted clean scan provenance.

### Product/version consistency

`product.currentVersion` должен соответствовать newest safe published build по стабильному порядку времени/id.

---

## 11. Entitlement

Entitlement — generic право субъекта на действие с ресурсом.

### Subject types

В текущей модели возможны:

```text
user
server
organization
```

Типичный смысл:

- permission;
- resourceId;
- expiry;
- metadata.

### Current beta

Free claim создаёт/использует entitlement без денежной транзакции.

---

## 12. License

License — более специализированная форма права использования продукта.

Поля включают:

- product;
- user;
- optional server;
- model;
- status;
- expiry;
- entitlements;
- key.

### Current state family

```text
active
expired
revoked
suspended
```

### Status

License infrastructure существует в модели, но полноценная платная licensing/DRM business flow в current closed beta не включена.

---

## 13. Claim

Conceptual claim — пользовательское действие «получить бесплатный ресурс».

Текущая реализация опирается на entitlement/access semantics, а не на paid Purchase.

### Правила

- только опубликованный free product;
- только safe downloadable build;
- idempotent retry;
- один активный logical claim в serialized path;
- счётчик увеличивается только при действительно новом claim.

---

## 14. Order / OrderItem / Payment

### CURRENT SCHEMA, DISABLED PRODUCT FLOW

Commerce tables присутствуют как архитектурное наследие/подготовка:

- Order — намерение/агрегат заказа;
- OrderItem — снимок строки заказа;
- Payment — interaction с payment provider.

### Critical distinction

```text
Purchase/ownership != Payment != License
```

Это важный принцип legacy MTA Market, который следует сохранить, если paid commerce вернётся.

### DECISION

Наличие этих таблиц не означает, что checkout должен работать сейчас.

---

## 15. Content

Content Engine покрывает опубликованные материалы платформы и сообщества.

Fields позволяют связать материал с:

- author;
- server;
- product;
- organization.

Тип может представлять article/devlog/announcement и иные контролируемые форматы.

### Lifecycle

Текущая схема допускает статус publication. Конкретная UI/workflow policy должна оставаться moderation-aware.

---

## 16. Comment / Review

Comments могут относиться к content и product.

Для product review действует uniqueness per author.

### Trust principle

Отзыв не должен выглядеть verified, если система не доказала соответствующее взаимодействие.

Legacy vision предусматривала разные eligibility policies:

- resource review — после acquisition/purchase;
- server review — после verified interaction token;
- seller review — после completed transaction.

Только реально реализованная eligibility может быть показана как verified.

---

## 17. Reaction

Reaction — lightweight community interaction.

Не должна использоваться как security/reputation доказательство сама по себе.

---

## 18. Follow

Follow связывает:

- follower user;
- target type;
- target id.

Unique constraint предотвращает дубликаты.

### Conceptual targets

Платформа может поддерживать follow для:

- server;
- creator;
- resource;
- content/thread.

Фактический список должен определяться current routes/code.

---

## 19. Notification

Notification принадлежит recipient.

Может содержать:

- title/message fallback;
- structured data;
- read state;
- target/deep link context.

### Preferences

Категории:

- follows;
- content;
- server;
- commerce;
- system.

### Принцип

Preference не должна отключать обязательные security/system сообщения, если это нарушает безопасность. Граница должна быть явной.

---

## 20. AuditEvent

AuditEvent — append-like evidence значимого действия.

Типичные области:

- auth/context;
- resource lifecycle;
- moderation;
- server ownership;
- verification;
- download start;
- administration.

### Требования

Audit должен быть:

- семантически точным;
- связанным с actor и target, когда применимо;
- неизменяемым обычным пользовательским UI;
- не содержать secrets.

---

## 21. Report

Report — жалоба пользователя на target.

Fields включают:

- reporter;
- target type/id;
- reason/evidence;
- status;
- resolution metadata.

### Policy

Report submission и notification модератору — разные гарантии. Если жалоба сохранена, сбой уведомления не должен заставлять клиента думать, что жалоба исчезла.

---

## 22. ModerationCase

ModerationCase связывает review с target/report.

Используется для:

- pending state;
- moderator;
- decision;
- notes;
- timestamps.

### Concurrency

Два модератора не должны тихо «перезаписывать» решение друг друга.

---

## 23. VerificationRequest

VerificationRequest — отдельный trust workflow.

Target types в текущей схеме:

```text
user
developer
organization
server
```

States:

```text
pending
approved
rejected
```

### Trust semantics

Verification — подтверждение конкретного свойства, а не универсальный знак «этому человеку можно верить во всём».

---

## 24. Badge — conceptual layer

В legacy model Badge был visual representation verified property.

Примеры:

- Verified Developer;
- Verified Server;
- Server Owner;
- Community Contributor.

### OPEN

В NEXUS следует решить, какие badges действительно нужны и какие evidence rules стоят за каждым. Нельзя продавать trust badge как cosmetic subscription perk.

---

## 25. Seller — conceptual capability

### CURRENT

Отдельный Seller entity/workflow не является активной частью closed beta.

### LEGACY INTENT

Seller — capability поверх User:

```text
USER
-> APPLICATION
-> REVIEW
-> APPROVED
-> SELLER
```

Seller потенциально получает:

- storefront;
- resources;
- sales analytics;
- reviews;
- reputation;
- seller permissions.

### OPEN

Нужно решить, вернётся ли такой формальный seller onboarding или любой developer сможет бесплатно публиковать после обычной moderation.

---

## 26. Deal / Guarantee — legacy future domain

Legacy модель разделяла:

```text
Deal
-> participants
-> subject
-> funding
-> delivery
-> verification
-> completion / dispute
```

Guarantee — финансовый механизм внутри Deal, а не просто badge.

### CURRENT

Не реализовывать в closed beta без отдельного legal/payment design.

---

## 27. DRM / Installation / Lease — legacy future domain

Legacy MTA Market проектировал:

```text
Purchase
-> License
-> Installation
-> challenge/activation
-> Lease
-> protected delivery/runtime
```

### Security framing

DRM может повысить стоимость массового копирования и сделать лицензии контролируемыми/атрибутируемыми, но не обеспечивает абсолютную защиту от reverse engineering.

### CURRENT

Не часть текущего NEXUS release scope.

---

## 28. Основные связи ownership

### User-owned

- personal profile;
- sessions;
- personal resources;
- personal servers;
- personal content;
- follows;
- notifications.

### Organization-owned

Возможны:

- resources;
- servers;
- content.

Доступ определяется membership/permissions, а не только первоначальным authorId.

---

## 29. Visibility matrix

### Public by design

После publication/visibility checks:

- public resource metadata;
- safe build version metadata без storage secrets;
- public server profile;
- public server observations;
- published content;
- public profile fields;
- aggregate ratings/counts.

### Private by default

- email;
- passwords/auth internals;
- sessions;
- raw license keys;
- private entitlements;
- private organization membership details where not explicitly surfaced;
- moderation internals;
- security metadata;
- storage keys;
- payment provider secrets;
- buyer identity lists;
- private server/control evidence.

---

## 30. State-machine discipline

Любая новая lifecycle entity должна иметь:

1. список состояний;
2. допустимые переходы;
3. authority для перехода;
4. side effects;
5. transaction boundary;
6. audit event;
7. notification semantics;
8. retry/idempotency rule;
9. terminal states;
10. recovery behavior.

Нельзя кодировать lifecycle набором несвязанных boolean-флагов, если сущность реально имеет состояния.

---

## 31. Data privacy principle

Ключевая продуктовая формула, унаследованная из legacy vision:

> Не показывай то, на раскрытие чего владелец не соглашался.

Особенно для:

- server technical data;
- staff;
- purchase/acquisition history;
- private deals;
- private communication;
- player identity;
- security metadata.

---

## 32. Real data principle

Нельзя показывать:

- fake online;
- fake sales;
- fake ratings;
- fake verified badges;
- fake «download successful»;
- feature controls, за которыми нет working backend.

Demo fixtures должны явно называться demo, если не представляют настоящую функциональность.

---

## 33. Терминологический словарь

| Термин | Значение |
|---|---|
| User | единая identity платформы |
| Actor | identity + текущий context, от имени которого выполняется действие |
| Organization | командный owner/context |
| Server | MTA server profile + platform ownership + observations |
| Observation | полученный извне снимок live-состояния сервера |
| Resource/Product | распространяемый MTA resource |
| Build | конкретный versioned artifact ресурса |
| Claim | бесплатное получение доступа |
| Entitlement | право субъекта на ресурс/действие |
| License | специализированное право использования, потенциально server-bound |
| Follow | подписка на обновления target |
| Verification | подтверждение конкретного свойства через evidence/review |
| Report | жалоба пользователя |
| Moderation | platform decision о допустимости/состоянии объекта |
| Audit | внутреннее доказательство выполненного системного действия |
| Payment | interaction с платёжным provider, не право собственности |
| Seller | возможная capability разработчика для коммерции |

---

## 34. Открытые data-model вопросы

### OPEN D-01

Нужно ли формально разделить `Product` и `Resource` в терминологии, или UI/documentation всегда называет MTA-объект Resource, оставляя Product техническим названием?

### OPEN D-02

Нужен ли отдельный SellerProfile, или developer profile + verification/capabilities достаточно?

### OPEN D-03

Какую модель server ownership выбрать для организаций: один owner user, org owner, оба, transfer workflow?

### OPEN D-04

Нужны ли публичные server/resource compatibility relations и dependency graph?

### OPEN D-05

Нужно ли сохранять dormant commerce tables до решения о монетизации или отделить их migration/module boundary?

### OPEN D-06

Какие aggregate metrics публичны, а какие private analytics?

### OPEN D-07

Какие exact badge types будут официальными и каков evidence для каждого?
