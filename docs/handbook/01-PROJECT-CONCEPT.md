# 01. Общий концепт MTA NEXUS

## 1. Миссия

MTA NEXUS должен стать **единой площадкой для всего сообщества MTA:SA** — местом, куда одинаково естественно приходят игрок, владелец сервера, разработчик, покупатель, автор контента и участник сообщества.

Пользователь открывает платформу не потому, что ему обязательно нужно что-то купить. Он может прийти ради живого сервера, обновления, статьи, разработчика, ресурса, обсуждения или собственного проекта. Чем глубже он взаимодействует с экосистемой, тем больше связанных возможностей получает внутри одного аккаунта.

## 2. Какую проблему решает продукт

Экосистема MTA фрагментирована. Серверы, ресурсы, сообщества, разработчики, новости и доверие обычно существуют отдельно.

Из этого возникают типичные проблемы:

- сложно понять, какие серверы действительно живы сейчас;
- страницы серверов и рекламные описания могут не совпадать с реальным состоянием;
- файлы ресурсов приходится получать из источников с разным уровнем доверия;
- история автора, ресурса, сервера и обновлений распадается между площадками;
- пользователю сложно отличить верифицированное действие от маркетингового заявления;
- у владельца сервера нет единого места, где можно подтвердить владение, оформить страницу, публиковать обновления и наращивать аудиторию;
- у автора ресурса нет единого безопасного lifecycle публикации и обновлений;
- модерация без доказательств и audit trail плохо масштабирует доверие.

MTA NEXUS связывает эти области общей identity, moderation, notifications, trust и content model.

## 3. Центральная ценность

MTA NEXUS полезен не наличием отдельной функции, а интеграцией.

Пример пользовательского пути:

`Live directory → server page → follow → update → author/resource → safe download → comment/review → notification → return`

Пример пути владельца сервера:

`Find existing directory entry → prove control → claim server → customize → publish updates → gain followers → build history/reputation`

Пример пути автора ресурса:

`Account → workspace → draft → upload → scan → moderation → publish → release update → notification → trusted portfolio`

## 4. Product pillars

### 4.1 Servers

CURRENT.

Серверы — один из главных входов в продукт:

- live directory из публичного MTA source;
- публичная server page;
- online/live state;
- история наблюдений;
- владение и claim challenge;
- management workspace;
- updates;
- followers;
- связь с владельцем или организацией.

### 4.2 Resources

CURRENT.

Ресурс — не просто ZIP-файл. Это управляемая сущность:

- карточка;
- тип и теги;
- автор или организация;
- версии/builds;
- MTA compatibility target;
- artifact metadata;
- malware scan;
- moderation lifecycle;
- безопасная выдача;
- entitlement/library state;
- комментарии/отзывы;
- portfolio автора.

Closed beta распространяет только бесплатные ресурсы.

### 4.3 Community & Content

CURRENT foundation + CONFIRMED TARGET: community должен стать большим самостоятельным направлением. Чем больше полезного времени пользователь проводит внутри NEXUS и чем больше связанных сценариев закрывает платформа, тем сильнее продукт.

- статьи и другие content types;
- комментарии;
- реакции;
- связи с сервером, ресурсом и организацией;
- публикация и moderation;
- follow/notification mechanics;
- публичные профили.

OWNER DECISION: полноценный forum/news/content/community hub нужен. Это не означает бессмысленный social-media clone: удержание должно строиться на полезных обсуждениях, знаниях, обновлениях, событиях, взаимодействии вокруг серверов и ресурсов.

### 4.4 Identity

CURRENT.

Один пользователь — одна platform identity.

Один аккаунт может одновременно быть:

- обычным игроком;
- автором ресурса;
- владельцем сервера;
- участником организации;
- модератором или администратором.

Не нужно создавать отдельный аккаунт для каждой продуктовой роли.

### 4.5 Trust

CURRENT foundation.

Trust — не одна цифра рейтинга.

Он строится из доказательств:

- подтверждённое владение сервером;
- verification workflow;
- clean scan provenance;
- SHA-256 и integrity checks;
- история версий;
- moderation decision;
- report evidence;
- audit events;
- server-observed data;
- публичные и приватные границы.

OWNER DECISION: trust layer должен расширяться любыми дополнительными доказательствами и статусами, если у них есть понятный смысл и проверяемая семантика. Verified Seller/Developer/Server/Organization, verified interactions, provenance, transaction-backed reviews и другие сигналы допустимы как направления развития.

## 5. Для кого продукт

### Игрок

Хочет быстро понять, куда зайти сегодня, что происходит на сервере и можно ли доверять материалам вокруг него.

### Автор / Developer

Хочет публиковать MTA-ресурсы, собирать portfolio, выпускать версии и иметь понятный moderation/safety lifecycle.

### Владелец сервера

Хочет подтвердить сервер, управлять страницей, показывать реальное состояние, публиковать обновления и собирать аудиторию.

### Команда / Organization

Хочет владеть ресурсами и контентом не через одного личного пользователя, а через организационный контекст и permissions.

### Модератор

Хочет работать не с бесконечным ручным хаосом, а с очередями, evidence, обязательными решениями, ограниченными страницами и audit trail.

### Администратор

Хочет видеть состояние продукта и управлять исключительными действиями без обхода доменных правил.

## 6. Уникальность

MTA NEXUS не должен конкурировать только дизайном или количеством функций.

Его потенциальная уникальность:

1. **Live MTA discovery + platform identity.** Сервер можно найти из реального directory, затем привязать к владельцу и развивать как платформенную сущность.
2. **Resource provenance.** Публичный файл связан с конкретной build-записью, scanner identity, scan time, hash и moderation state.
3. **One ecosystem.** Пользователь, сервер, организация, ресурс, статья и уведомления связаны единым account/context layer.
4. **Honest states.** UNKNOWN лучше ложного OFFLINE, pending review лучше фальшивого «опубликовано», started download не называется completed delivery.
5. **Server-authoritative UX.** Клиент не дорисовывает успех на основании догадки.
6. **Privacy by default.** Приоритет агрегатов и явного opt-in вместо скрытого сбора данных игроков или инфраструктуры.
7. **AI-ready engineering discipline.** Источники истины, test gates, audit и decision register уменьшают вероятность, что новый агент сломает продуктовую модель.

## 7. Что продуктом не является

MTA NEXUS не должен превращаться в:

- generic social network;
- обычный форум без уникальной связи с MTA;
- простой каталог ZIP-файлов;
- копию Steam;
- рекламный портал;
- бесконечную систему бейджей и gamification;
- технический dashboard, понятный только разработчику;
- marketplace любой ценой.

## 8. Принцип «real data only»

Любой публичный факт должен иметь источник.

Примеры:

- online сервера — результат observation, а не ручное поле;
- clean resource — реальный scan + scanner + timestamp;
- ownership — результат claim/verification workflow;
- moderation state — реальное решение;
- download success — нельзя утверждать только потому, что HTTP-response был создан;
- рейтинг/покупки/подписчики — только реальные данные, если когда-либо показываются.

## 9. North Star

OWNER DECISION: важна глубина экосистемы и время, которое пользователь **полезно** проводит на сайте. Продажи — лишь одна часть здоровья продукта.

Для NEXUS это можно сформулировать так:

> Пользователь возвращается в MTA NEXUS, потому что здесь есть актуальная и заслуживающая доверия информация или действие вокруг его MTA-жизни.

Точная формула метрики ещё OPEN, но она должна учитывать meaningful activity/retention, а не только GMV или количество скачиваний.

## 10. Ecosystem loops

### Player loop

`Discover server → inspect real state → join/follow → read update → return`

### Resource loop

`Discover → inspect author/build → acquire safely → use → follow updates → return`

### Creator loop

`Create → scan → moderate → publish → update → build portfolio → return`

### Server owner loop

`Discover/claim → verify → customize → update → gain audience → observe history → return`

### Trust loop

`Evidence → verified state → safer interaction → reputation/context → stronger trust`

## 11. Подтверждённая целевая модель

OWNER DECISION 2026-10-06:

```text
                     MTA NEXUS
                         │
   ┌──────────┬──────────┼──────────┬──────────┐
   │          │          │          │          │
 Servers   Resources  Community   Content   Marketplace
   │          │          │          │          │
   └──────────┴──────────┼──────────┴──────────┘
                         │
                       Trust
                         │
                      Identity
                         │
                  Platform Services
            Payments / Subscriptions / DRM
```

Ни SERVER, ни MARKET, ни COMMUNITY не являются единственным центром. Они должны усиливать друг друга.

### Коммерческая цель

- платные ресурсы входят в стратегию;
- базовая marketplace commission — 10%;
- подписки и разовые платные функции могут существовать во всех разумных продуктовых областях;
- отдельное ручное seller-одобрение не должно быть обязательным входным барьером; модерируется продукт;
- DRM capability обязательна как часть коммерческой системы, но seller включает её для конкретного продукта опционально;
- текущая free closed beta остаётся техническим этапом и не определяет финальную бизнес-модель.

### Server discovery goal

OWNER DECISION: NEXUS показывает все публичные серверы, которые видит MTA master list, даже если их владелец не зарегистрирован в NEXUS. Claim подтверждает управление и открывает расширенные функции, но не является условием появления сервера в каталоге.

### Commercial operations goal

OWNER DECISION: payment architecture должна быть multi-provider/multi-method и расширяться настолько широко, насколько это законно и practically доступно. Для seller payouts предпочтительна схема, которая перекладывает KYC/settlement/reconciliation на marketplace-capable provider и минимизирует ручные операции владельца бизнеса.

### DRM operating goal

Для защищаемого ресурса target flow: `Purchase → License → Installation/Server → Activation → Lease`, с offline grace 7 дней. Runtime/module должен быть универсальным: один compiled artifact обслуживает множество серверов, а индивидуальность задаётся лицензиями, ключами и server/installation binding.

### Community goal

NEXUS должен давать много причин оставаться внутри платформы: обсуждения, статьи, новости, обновления, профили, события, follow/feed/notifications, ресурсы, серверы и коммерческие сценарии. Удержание должно возникать из пользы и связности продукта, а не из искусственных engagement-механик.