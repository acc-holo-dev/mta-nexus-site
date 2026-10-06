# 02. Роли, контексты и полномочия

## 1. Основной принцип

В MTA NEXUS роль — это не обязательно отдельный тип аккаунта.

Один `User` может одновременно:

- играть;
- владеть сервером;
- публиковать ресурсы;
- состоять в организации;
- писать статьи;
- иметь moderation/admin capabilities.

Контекст выполнения действия важнее красивого бейджа.

## 2. Роли текущей схемы

CURRENT: поле `users.role` поддерживает значения концептуально уровня:

- `user`;
- `developer`;
- `server_owner`;
- `moderator`;
- `admin`.

Это coarse role. Реальное разрешение на действие дополнительно зависит от ownership, organization membership, permissions и конкретного объекта.

## 3. Guest

### Может

- открывать публичный Home;
- смотреть live server directory;
- открывать публичные server pages;
- просматривать опубликованные статьи/контент;
- просматривать каталог безопасных бесплатных ресурсов;
- открывать публичные профили пользователей/разработчиков/организаций.

### Не должен

- видеть приватные данные;
- получать unpublished resource builds;
- выполнять действия, требующие identity;
- получать management/admin metadata.

## 4. User / Player

Базовый зарегистрированный пользователь.

### Возможности

- account/session management;
- email verification/recovery flows;
- follow entities;
- получать и отмечать notifications;
- сохранять/получать бесплатные ресурсы;
- иметь личную library/entitlements;
- писать разрешённые комментарии и отзывы;
- подавать reports;
- подавать verification requests;
- инициировать server claim, когда policy это разрешает.

## 5. Developer / Author

CURRENT: автор управляет бесплатными resource entities и их builds.

### Возможности

- создать draft ресурса;
- редактировать разрешённые metadata fields;
- загрузить build;
- указать version/release notes/MTA target;
- отправить build в moderation lifecycle;
- видеть review notes;
- выпускать новые версии;
- видеть собственный private workspace;
- формировать публичный developer/profile portfolio после публикации.

### Ограничения

- нельзя самостоятельно объявить небезопасную сборку опубликованной;
- нельзя менять ownership, status, price или slug обходным PATCH;
- авторство исторической записи не должно давать вечное право после переноса ownership в организацию;
- build должен пройти безопасный upload/scan/moderation path.

## 6. Server Owner

CURRENT: пользователь, получивший право управлять конкретным server object.

### Возможности

- подтвердить контроль через server claim challenge;
- после подтверждения управлять разрешёнными editorial/server fields;
- вести server updates;
- работать через workspace;
- управлять связанной публичной информацией в рамках policy.

### Trust boundary

Directory presence не равно ownership.

Сервер может существовать в NEXUS как observed public entity до того, как кто-либо подтвердил право управления им.

## 7. Organization

CURRENT.

Организация — отдельный ownership context для команды.

### Organization member roles

Текущая схема поддерживает:

- `owner`;
- `admin`;
- `developer`;
- `member`.

Дополнительно хранится массив permissions.

### Зачем нужен organizational context

- командное владение ресурсами;
- командное авторство/публикации;
- разграничение доступа без передачи личного аккаунта;
- публичная organization page;
- перенос ответственности от конкретного historical author к актуальной команде.

### Важный инвариант

CURRENT: authorization строится по текущему actor context, ownership и membership. Старое `authorId` не является вечным bypass.

## 8. Moderator

CURRENT.

Модератор работает через ограниченные очереди и должен принимать явные решения.

### Основные области

- reports;
- verification requests;
- resource build review;
- content moderation;
- другие moderation queues, поддержанные текущей admin surface.

### Правила

- decision должен иметь достаточный context/reason, где policy это требует;
- concurrent/stale decision должен завершаться конфликтом, а не двойным применением;
- moderation state и audit должны быть атомарными там, где это заявлено;
- модератор видит только необходимое для решения;
- пользовательская жалоба не становится публичным обвинением.

## 9. Admin

CURRENT.

Admin имеет расширенные maintenance/moderation полномочия, но не должен обходить доменные инварианты.

Админ-панель включает/может включать:

- moderation queues;
- verification queue;
- resource build review;
- content moderation;
- reports history;
- aggregate counts;
- privileged artifact review/download path;
- maintenance operations, для которых предусмотрен policy.

**DECISION:** admin action не означает «можно нарушить clean-build rule, audit, ownership или transaction integrity».

## 10. Seller / Developer — целевая модель

### CURRENT

В closed beta Developer/Author публикует бесплатные ресурсы. Отдельный seller account не нужен.

### OWNER DECISION

Платный marketplace должен развиваться **без обязательной ручной заявки «Стать продавцом»**. Основной gate — конкретный продукт и его публикационный lifecycle, а не статус человека как разрешение вообще что-либо продавать.

Базовая модель:

`User → Developer/Creator capability → Product submission → moderation/safety → publication`

Когда paid commerce включён, тот же пользователь может продавать разрешённые продукты без отдельного seller-account. Seller — скорее коммерческая capability/состояние профиля, а не отдельная identity.

Платные планы могут давать automation, ускоренные workflows, расширенную аналитику, API, оформление и другие преимущества. **OWNER DECISION:** auto-publish доступен только через подписку и может пропускать ручную moderation queue, но никогда не отключает обязательные technical safety gates: artifact validation, malware scan, integrity/provenance, authorization и machine-readable policy checks. Хорошая история публикаций без подписки сама по себе не включает auto-publish.

Продавать может любой зарегистрированный пользователь в рамках product flow. Verified Seller/Developer — отдельный evidence-based trust status и не является входным разрешением на selling. Payment provider при реальных выплатах может отдельно требовать KYC — это legal/payment obligation, а не NEXUS verification badge.

## 11. Buyer — что это означает сегодня

### CURRENT

Пользователь может получить бесплатный ресурс и получить entitlement/library state.

### CONFIRMED TARGET

Buyer сможет приобретать paid Resource, после чего получает Purchase + License/Entitlement. Payment остаётся отдельной сущностью и не считается самой покупкой. Для защищаемых коммерческих ресурсов право использования связывается с DRM lifecycle.

## 12. Контекст и переключение identity

CURRENT: пользователь может действовать в личном или organizational context.

Смена контекста:

1. проверяет актуальный доступ;
2. блокирует необходимые строки;
3. меняет `activeContextId`;
4. записывает audit;
5. откатывается, если audit write не удался.

Повторный выбор того же контекста не должен создавать audit noise.

## 13. Capability matrix

| Действие | Guest | User | Developer/Author | Server Owner | Org privileged member | Moderator | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| Публичный каталог серверов | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Follow / notifications |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Получить free resource |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Создать resource draft |  | policy | ✓ | policy | permission | ✓* | ✓* |
| Управлять своим ресурсом |  |  | ✓ |  | permission | policy | ✓ |
| Claim server |  | ✓ | ✓ | ✓ | permission | policy | ✓ |
| Управлять claimed server |  |  |  | ✓ | permission | policy | ✓ |
| Подать report |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Решать moderation queue |  |  |  |  |  | ✓ | ✓ |
| Административное обслуживание |  |  |  |  |  | ограниченно | ✓ |

`*` — не означает возможность публиковать вместо автора или обходить ownership; это maintenance/moderation capability в рамках policy.

## 14. Открытые решения

1. Нужна ли отдельная роль `creator`, объединяющая статьи и ресурсы, или достаточно capabilities?
2. Должен ли Server Owner быть глобальной role или только ownership relation на конкретных server objects?
3. Какие organization permissions должны быть стабильным публичным контрактом?
4. Нужны ли staff subroles для сервера отдельно от Organization?
5. Нужен ли отдельный **Verified Seller** badge как trust signal, если отдельной seller-заявки нет?
6. Что именно даёт платный auto-publish: приоритет очереди, автоматическое решение после технических checks или иной workflow?


## 13. Owner decisions — staff specialization (Round 3)

**DECISION:** административная зона строится не как один универсальный экран, а как набор специализированных отделов/поверхностей управления. Минимальная целевая матрица:

- `Support` — обращения, базовые account/service cases;
- `Community Moderator` — forum, comments, posts, community spaces;
- `Content Moderator` — articles, guides, devlogs, server news, homepage/editorial submissions;
- `Resource Moderator` — product metadata, builds, safety/moderation decisions;
- `Server Moderator` — server claims, server pages, ownership abuse, server-specific cases;
- `Verification Moderator` — evidence review и verification lifecycle;
- `Dispute / Finance Manager` — internal disputes, refunds workflow, payout/PSP reconciliation access by capability;
- `Security / Trust Moderator` — abuse, high-risk investigations, blacklist/SCAM evidence, escalations;
- `Administrator` — broad operational administration;
- `Super Admin` — exceptional platform-wide and capability-management authority.

Один staff-пользователь может одновременно иметь несколько staff capabilities/roles. Не моделировать это взаимоисключающим enum, если это мешает cumulative permissions. Предпочтительна capability-based модель с audit trail.

### 13.1 Least privilege

Даже если сотрудник имеет несколько ролей, каждая чувствительная операция проверяет конкретную capability. Финансовый доступ, просмотр приватных evidence, security controls, impersonation-like support actions и destructive operations не должны автоматически следовать из простого `moderator=true`.

### 13.2 Functional sanctions

DECISION: наказание может ограничивать отдельную capability пользователя без полного удаления аккаунта. Примеры: запрет продавать, публиковать, создавать community spaces, писать сообщения или управлять сервером при сохранении остальных разрешённых функций.