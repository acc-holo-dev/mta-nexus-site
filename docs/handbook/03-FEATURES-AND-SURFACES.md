# 03. Функции сайта и продуктовые поверхности

## 1. Home

CURRENT foundation.

Home должен показывать, что MTA NEXUS — живая MTA-платформа, а не статичный магазин.

Целевые элементы:

- актуальные MTA servers;
- полезные переходы в directory;
- новые ресурсы;
- статьи/обновления;
- activity signals, только если они основаны на реальных данных;
- персонализация после входа без ухудшения guest experience.

LEGACY INTENT: «Сейчас в MTA», global live aggregates, popular discussions и personalized «за ночь» dashboard.

## 2. Server Directory — `/servers`

CURRENT + OWNER TARGET.

OWNER DECISION: directory включает **все публичные MTA-серверы**, которые видит master list. Регистрация/claim владельца не является условием discovery. Claim добавляет verified ownership и management capabilities.

### Пользователь получает

- публичный список живых серверов;
- search/discovery;
- current/observed server state;
- переход на server detail;
- честное обозначение stale/unknown состояния при проблемах источника.

### Источник

CURRENT: официальный/публичный MTA directory path читается как bounded stream.

Ограничения:

- максимум 8 MiB ответа;
- максимум 10 000 серверов;
- stale snapshot не старше 15 минут после неудачного refresh;
- outage retries не продлевают stale deadline.

## 3. Server Detail — `/servers/[slug]`

CURRENT.

Публичная страница может объединять:

- название и editorial metadata;
- current observed state;
- players/max players;
- game mode / map / relevant directory fields;
- owner/organization, если подтверждены и публичны;
- follow control;
- updates/history;
- link to MTA connection path;
- claim status/ownership state;
- related content where policy allows.

Нельзя выдавать editorial field за live observation.

## 4. Server Claim

CURRENT.

Сценарий:

1. пользователь выбирает server entry;
2. создаётся challenge;
3. challenge содержит безопасный token digest и expiry;
4. proof проверяется против актуального source state;
5. создаётся verification relation/request;
6. ownership/moderation завершается отдельно согласно policy.

DECISION: proof of server control и moderator ownership approval — разные понятия.

## 5. Server Workspace

CURRENT.

`/workspace/servers` и management pages дают владельцу управляемый интерфейс вместо прямой работы с API.

Области:

- список управляемых серверов;
- создание/привязка;
- editorial metadata;
- updates;
- claim/control information;
- visibility/policy-dependent settings.


### Target Server Pro

OWNER DECISION: Server Pro может включать весь профессиональный набор: расширенное оформление, глубокую историю, аналитику, API/webhooks, alerts, больше media, team tools, automation и promotion. Платный план не может переписать observed MTA state или купить verification/trust.

## 6. Market — `/market`

CURRENT closed-beta meaning: **библиотека бесплатных ресурсов**.

### Каталог

- text search;
- category/type filter;
- несколько sort modes;
- bounded pagination;
- cards;
- безопасная public visibility только при наличии trusted clean build.

### Product types

CURRENT registry содержит девять типов; конкретный список должен читаться из `packages/domain/src/product-types.ts`, а не дублироваться в новом клиентском справочнике.


### TARGET marketplace expansion

Каталог должен поддерживать free и paid resources. Paid flow разделяет Order/Payment/Purchase/License. Seller может включить DRM для конкретного продукта, но DRM не обязателен для каждой продажи. Sponsored resources/servers разрешены при явной маркировке и не влияют на security/verification truth.

## 7. Resource Detail — `/market/[slug]`

CURRENT.

Показывает:

- title;
- description;
- author/organization;
- type/tags;
- current version;
- build/release information;
- MTA compatibility;
- comments/reviews;
- dependency information, если она существует;
- безопасный acquire/download action.

### Download UX

- same-origin authenticated fetch;
- ошибки остаются на странице;
- RU/EN messages;
- bounded bytes;
- length checks;
- reject HTML/JSON error page as binary;
- abort/cancel support;
- success означает handoff подтверждённого полного response, а не обещание, что ОС физически сохранила файл.

## 8. Resource Acquisition

CURRENT.

Closed beta использует free claims/entitlements.

Инварианты:

- product опубликован;
- price = 0 в public free path;
- существует safe downloadable build;
- retry должен переиспользовать активный entitlement;
- concurrent path сериализуется;
- salesCount/claim counters не должны раздуваться повторами.

## 9. Author Resource Workspace

CURRENT.

### `/workspace/resources`

- manageable free resources;
- drafts, pending и опубликованные состояния;
- filters;
- bounded pages.

### `/workspace/resources/[id]`

- metadata edit;
- upload another build;
- version history;
- moderation notes;
- retirement controls according to policy.

### `/workspace/resources/new`

Author flow:

`metadata → draft → archive → scan → build record → moderation → result`

Важная UX-фича: при ошибке файл и контекст не должны теряться без необходимости. Retry/recovery должен возвращать тот же draft/build при точном совпадении identity и metadata, а не создавать дубли.

## 10. Scanner / Resource Inspector

CURRENT core.

- bounded multipart body;
- ClamAV INSTREAM;
- incomplete scan fails closed;
- SHA-256;
- safe filename handling;
- MTA `meta.xml` inspection;
- MTA version target parsing;
- preview ACL/export declarations без автоматического объявления их безопасными.

PROPOSED/LEGACY direction:

- richer Resource Inspector;
- dependency graph;
- compatibility intelligence;
- GitHub import;
- provenance chain.

## 11. Content / Articles

CURRENT foundation.

- content feed;
- detail by slug;
- author;
- optional links to server/product/organization;
- comments;
- moderation states;
- public publication controls;
- cover URLs with shared HTTP(S) policy.

LEGACY INTENT: более широкий editorial hub, news и devlogs.


## 11.1 Target Community Hub

OWNER DECISION: community — крупный самостоятельный слой. Target включает общий forum, server/resource discussions, articles/guides, news, developer devlogs, server updates, activity feed, notifications, events/contests и позже personal messages. Некоторые content/discussion types должны проходить pre-moderation; остальные могут использовать post-moderation/reporting.

## 12. Profiles

CURRENT.

### User profile

- public identity;
- safe public metadata;
- author resources;
- owned public servers;
- paginated surfaces.

### Developer profile

- trusted public portfolio;
- published/free/safe resources;
- SEO-safe pagination/canonical behavior.

### Organization profile

- public metadata;
- resources;
- articles;
- team-owned surfaces according to visibility policy.

## 13. Follow system

CURRENT.

`Follow` — бесплатная продуктовая подписка на entity/activity, не paid subscription.

Текущая модель хранит:

- follower;
- target type;
- target id.

Пользовательский результат должен подтверждаться сервером, включая target identity и итоговое состояние.

## 14. Notifications

CURRENT.

- in-app notification center;
- bell/menu;
- read state;
- preferences categories;
- structured build review notifications;
- links к действию;
- race-safe refresh behavior.

Notification preferences включают категории follows/content/server/commerce/system, даже если paid commerce отключён.

## 15. Auth & Account

CURRENT.

- register;
- login;
- session;
- sessions management;
- email verification;
- password recovery;
- password change;
- context switching;
- secure mail worker/recovery path.

## 16. Reports

CURRENT.

Пользователь может сообщить о проблеме с supported target.

Report model:

- reporter;
- target type/id;
- reason/context;
- evidence links;
- pending/resolved state;
- moderator decision;
- audit.

Evidence URL policy применяется и на входе, и при moderator rendering.

## 17. Verification

CURRENT.

Target types могут включать:

- user;
- developer;
- organization;
- server.

Verification request содержит proof URL/notes, decision state и resolution metadata.

## 18. Admin Panel — `/admin`

CURRENT.

Основные queues:

- reports;
- verification;
- resource builds;
- content drafts/moderation.

Поверхности должны быть paged и показывать полное pending count, а не только текущие 30 элементов.

Admin должен видеть достаточно evidence для решения, но не получать лишнюю приватную информацию.

## 19. Search

CURRENT beta may contain command-palette-style search mechanics, but **TARGET after Owner Round 5 removes command/action palette as a product requirement**.

Target requirements:

- ordinary global search surface;
- combobox/listbox semantics where search suggestions need them;
- keyboard navigation and real result activation;
- focus containment for dialogs that still exist;
- responsive mobile behavior;
- no requirement for users to learn commands or `Ctrl/Cmd+K` workflows.

## 20. Checkout — важное состояние

CURRENT: route/surface существует как часть технического наследия/границы продукта, но paid checkout в closed beta отключён.

Новый агент может развивать approved cart/commerce foundation, но не должен включать реальные payments до полного production payment gate и human approval.

## 21. Что пока не считать текущей функцией

Даже если это есть в старом MTA Market, для NEXUS это не CURRENT без нового решения:

- paid marketplace;
- seller payouts;
- user wallet/balance;
- crypto payments;
- guarantee deals;
- paid services marketplace;
- active DRM delivery;
- public blacklist;
- paid Pro subscription;
- promoted listing monetization;
- automated AI moderation decisions.

## 22. Round 4 target surfaces

### Marketplace

Первый commercial vertical — **MTA Scripts**.

Listing должен уметь показывать:

- Free/Premium edition;
- closed-source или open-source delivery;
- DRM enabled/disabled только там, где это применимо;
- bundles;
- coupons/discount state;
- price и license scope;
- mandatory changelog/version history;
- compatibility/dependencies;
- seller trust signals;
- update entitlement;
- verified review eligibility.

### Claimed server experience

После claim владелец получает расширенное оформление страницы, team roster, recruitment/vacancies, factions/clans, applications, events, media/content и Pro features. Live/observed данные при этом остаются server-authoritative и не могут переписываться владельцем.

### Organization experience

Organization — универсальная сущность команды. Нужны membership in multiple orgs, invites, granular permissions, ownership transfer, billing owner, audit log и публичная page/profile.

### Messaging / social

К первой коммерческой версии входят direct messages. Отдельно существуют user groups/clans, не обязанные быть Server или Organization. Messaging требует progressive anti-spam, block/mute/report и privacy controls.

### Forum authoring

Target editor/community supports Markdown, code blocks, images/files, approved embeds, polls, reactions, mentions и bookmarks. Content pipeline всегда sanitizes untrusted markup/media.

### Discovery

Server discovery объединяет ranking и filters. Marketplace ranking учитывает relevance, sales, rating, freshness, update frequency и seller trust. Sponsored inventory явно маркируется и не меняет organic rank.

### Personalization

Recommendations допускают interests, follows, browsing и purchases, но пользователь может полностью отключить personalization. Тогда UI возвращается к нейтральным recent/trending/filter-based surfaces.

## 25. Round 6 target surfaces

New confirmed target surfaces/contracts:

- adaptive `/workspace` for all capabilities;
- Buyer Library and per-purchase detail;
- rich commercial product page with source/DRM badges and dependency graph;
- `/discover`;
- Security Center;
- admin global case search;
- build/resource quarantine;
- malware exposure notifications;
- public profile with immutable ID + optional entitlement-bound vanity username + verified external links.

These are target product requirements; they are not claims that current closed-beta routes already implement every screen.