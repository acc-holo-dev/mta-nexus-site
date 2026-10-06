# 05. UX, UI и дизайн-принципы

## 1. Главная UX-цель

Технически сложная система должна ощущаться простой.

Пользователь не должен знать, что внутри есть:

- transaction locks;
- build provenance;
- entitlement serialization;
- audit atomicity;
- stale snapshots;
- storage hashing;
- idempotent recovery.

Он должен понимать:

- что происходит;
- почему действие доступно или недоступно;
- сохранились ли его данные;
- безопасно ли повторить действие;
- кто владеет объектом;
- насколько свежи отображаемые данные.

## 2. RU/EN как единый продукт

CURRENT и DECISION.

- locale определяется общей i18n foundation;
- один shell;
- одна navigation model;
- один набор semantics;
- перевод не должен создавать другой workflow;
- ошибки и пустые состояния должны быть локализованы так же, как happy path.

Не создавать второй механизм локализации.

## 3. Desktop navigation

CURRENT.

Desktop использует:

- persistent sidebar;
- top navigation;
- ясное разделение public discovery, workspace и account/admin areas.

Навигация должна помогать понять структуру платформы, а не просто перечислять routes.

## 4. Mobile navigation

CURRENT.

Ниже `lg` основные зоны доступны через fixed bottom navigation.

Требования:

- короткие RU/EN labels;
- отсутствие horizontal overflow;
- primary actions reachable одной рукой;
- content не перекрывается fixed navigation;
- критические формы работают на 320/390px.

## 5. Accessibility foundation

CURRENT partial acceptance.

Уже приняты направления:

- native `dialog` для modal surfaces и notifications;
- focus containment;
- `Tab` / `Shift+Tab` wrap;
- `Escape` close;
- focus return;
- skip-to-content;
- semantic combobox/listbox для search/autocomplete where needed;
- `aria-activedescendant` для suggestion/results widgets where appropriate;
- reduced-motion scenario;
- responsive keyboard acceptance.

CURRENT beta command-palette implementation не является target requirement: Round 5 explicitly chooses ordinary navigation + search instead of command UX.

Важно: browser tests не равны полному WCAG/screen-reader audit.

## 6. Server-authoritative success

DECISION.

UI не должен показывать optimistic success, если критическое действие не подтверждено backend.

Примеры:

- follow success — только если ответ подтверждает target и resulting state;
- resource draft reuse — только explicit recovery contract;
- build reuse — только explicit matching response;
- 409 сам по себе не означает, что желаемое действие уже выполнено;
- notification mark-read не должен угадывать состояние при race.

## 7. Ошибка — часть продукта

Качественный UX NEXUS обязан проектировать ошибки заранее.

### Resource upload

При scan/network/persistence ошибке:

- draft не теряется;
- форма сохраняет разумно возможный state;
- selected file не сбрасывается без причины;
- retry должен быть безопасным;
- duplicate slug/build объясняется без утечки чужой identity.

### Resource download

- ошибка остаётся на product page;
- пользователь получает понятный RU/EN message;
- есть progress/cancel;
- retry доступен;
- 404/409/499/timeout не превращаются в download неизвестного JSON/HTML файла.

### Server directory

- stale/unknown state обозначается честно;
- outage external source не делает весь Home непригодным на длительное время;
- cached snapshot имеет ограниченный срок доверия.

## 8. Trust должен быть видимым

Техническая безопасность без понятного UI почти не строит пользовательское доверие.

На resource page полезно показывать:

- version;
- publisher;
- moderation status;
- scan/trust signal;
- compatibility;
- changelog;
- last update.

На server page:

- observed/live state;
- freshness;
- claimed/verified owner state;
- history/updates;
- clear external links.

## 9. Профили как identity surface

Профиль не должен быть просто аватаркой.

Он может показывать релевантный вклад:

- public resources;
- servers;
- articles;
- organization membership только где это публично и уместно;
- verification badges с понятной семантикой.

Не превращать профиль в публичную выгрузку приватной активности.

## 10. Workspace philosophy

Public site отвечает на вопрос «что существует в экосистеме». Workspace отвечает на вопрос «что мне нужно сделать».

Поэтому workspace должен быть:

- task-oriented;
- private;
- без SEO;
- с ясными states;
- с review notes;
- с recoverable forms;
- без лишней публичной презентации.

## 11. Admin UX

Admin panel — рабочий инструмент, а не dashboard ради графиков.

### Приоритет

- pending count;
- oldest first;
- evidence;
- history;
- action reason;
- conflict handling;
- links к объекту;
- минимизация случайных irreversible actions.

Queue pagination должна быть частью UX, а не технической деталью.

## 12. Дизайн-идентичность

LEGACY vision задаёт полезный ориентир:

- Modern;
- Visual;
- Community-driven;
- Trust-oriented;
- Information-rich;
- Fast;
- Understandable;
- Distinctive.

Но информация важнее декоративности.

Насыщенный MTA-стиль допустим, если он не ухудшает:

- скорость;
- читаемость;
- accessibility;
- moderation;
- mobile experience;
- доверие.

## 13. Customization

Будущие server/creator worlds могут использовать:

- banners;
- covers;
- media;
- themed sections;
- badges;
- illustrations.

Но user-generated customization не должна:

- ломать layout;
- выполнять небезопасный код;
- скрывать platform trust information;
- создавать фальшивые системные badges;
- нарушать contrast/accessibility без ограничений.

## 14. Search

Search должен соединять экосистему.

Потенциальные result groups:

- Servers;
- Resources;
- Users/Developers;
- Organizations;
- Articles;
- позже Community topics.

Результат должен вести на реальную entity, а не на fake suggestion.

## 15. Пустые состояния

Пустой раздел должен объяснять следующий шаг.

Примеры:

- нет ресурсов → создать ресурс;
- нет claimed servers → найти/добавить сервер;
- нет notifications → объяснить, какие события их создают;
- moderation queue пуст → показать, что очередь действительно обработана;
- нет search results → предложить изменить фильтр, не показывать fake recommendations.

## 16. Performance UX

Performance является частью доверия.

Пользователь не должен ждать 10 секунд из-за внешнего MTA source на каждом SSR request. Failure backoff/cache boundaries должны изолировать внешнюю деградацию.

Большие downloads не должны неконтролируемо раздувать memory. Текущий browser path ограничен 64 MiB resource limit и должен оставаться bounded, пока архитектура специально не изменена.

## 17. OPEN дизайн-вопросы

1. Насколько визуально NEXUS должен наследовать gaming/MTA эстетику?
2. Нужны ли полностью кастомизируемые server pages или только controlled themes?
3. Какая зона должна быть главной после login: Home или personalized Dashboard?
4. Нужно ли объединить User и Developer profile в одну adaptive page?
5. Нужна ли PWA/mobile install experience?
6. Нужна ли dark-only identity или полноценные light/dark themes?


## 18. Round 3 UX decisions

### 18.1 Home

DECISION: homepage combines:

- prominent global search;
- a live "what is happening in MTA" layer;
- server discovery;
- resources/marketplace;
- community/feed/content;
- personalized block after authentication.

No single pillar should make the home page look like only a server monitor, only a store or only a forum.

### 18.2 Global search

DECISION: global search targets a federated experience across at least Servers, Resources, Users, Organizations, Articles/Guides and Forum Topics. Result types remain visually distinguishable and permission/visibility aware.

### 18.3 Profiles

DECISION: user profile may expose avatar, banner, bio, social links, badges, portfolio, highlighted resources/servers, achievements and activity subject to privacy controls. Paid plans may provide additional themes/customization, but trust indicators cannot be cosmetically forged or hidden in misleading ways.

### 18.4 Community spaces

DECISION: server owners and organizations may create and manage their own community spaces/subforums under platform policy and platform override. Ownership of a space does not remove NEXUS moderation authority.

### 18.5 Notifications

DECISION: notification delivery is multi-channel: in-app plus target support for email, Web Push, Telegram and Discord integrations. Channel availability/preferences must be per-user and event-class aware; sensitive security events cannot be silently disabled if policy requires them.

## 19. Round 5 — navigation, Home и onboarding

### 19.1 Одна Home-модель

DECISION: гостевая и авторизованная главная не являются двумя разными продуктами. Используется одна информационная архитектура:

- общий global search;
- live MTA/server block;
- resources/marketplace;
- community/content;
- news/events;
- понятные CTA для login/register/claim/publish;
- после входа те же зоны получают персональные modules, follow state, notifications и быстрый доступ к workspace.

Это сохраняет узнаваемость интерфейса до и после регистрации.

### 19.2 Onboarding

DECISION: после регистрации нужен короткий onboarding wizard. Он может спросить:

1. язык;
2. интересы;
3. любимые/интересующие servers;
4. resource categories;
5. основную деятельность/намерение: player, server owner, developer, buyer, community;
6. notification preferences.

Onboarding не создаёт жёсткую роль и может быть пропущен/позже изменён.

### 19.3 Personalization controls

Round 4 сохраняется: personalization можно полностью выключить. Round 5 уточняет: отдельные кнопки `Not interested` / `Hide author` / `Hide server` не являются обязательной UX-функцией. Не строить сложную micro-feedback system без доказанной необходимости.

### 19.4 No command palette

OWNER DECISION: глобальная command/action palette (`Ctrl/Cmd+K`) и интерфейс «команд» не нужны. Target navigation должна опираться на обычные navigation surfaces и явный search.

Если в CURRENT UI существует command-style search/dialog, считать это implementation detail текущей beta, а не target product requirement. Доступность клавиатурой, focus management и shortcuts для стандартных UI-controls сохраняются, но пользователь не должен учить команды.

## 20. Round 6 — Home, Discover and workspace UX

- Login returns to the ordinary Home experience, not a forced dashboard.
- Home uses finite ecosystem sections with `Показать больше`; infinite scroll belongs only in a dedicated Community Feed.
- `/discover` is a separate cross-ecosystem discovery surface.
- `/workspace` is one adaptive multi-role surface.
- Public profile is visible by default only through safe public fields.
- Immutable ID is the primary identity; subscription/eligible entitlement may add vanity username; changing it is a separate paid operation.
- Verified external links are shown as proof of control, not proof of quality.
- Top-level navigation remains Home / Servers / Market / Community / Messages / Notifications / Workspace/Profile, with Discover visibly reachable.
- No command palette or command-driven navigation.


## Round 8 — screen contracts

- Home: global search + ecosystem summary + Trending + finite entity sections.
- Guest CTA is contextual; no repetitive registration-wall design.
- `/discover`: separate entity tabs/sections; no heterogeneous mixed result stream.
- Public profile Activity is a timeline/feed. Dedicated Trust/Reputation tab is confirmed; it presents evidence, verified history and public moderation history rather than one opaque score.
- Purchase details use tabs.
- Publish Wizard is full-page.
- Server page customization uses visual safe block editor with desktop/mobile preview.
- Staff high-impact actions show impact preview before execution.
- Pricing must expose material economic differences transparently.
- PWA offline mode blocks sensitive writes and shows explicit Offline state.
- Production errors show correlation/request IDs, never stack traces.