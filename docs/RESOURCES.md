# Ресурсы, библиотека и публикация

**Статус:** integrated DOC-05 draft subject contract.

Предметный контракт DOC-05 для каталога ресурсов, версий/сборок, выдачи файла, приватной библиотеки, коллекций и seller-публикации. Не активирует коммерцию и не заменяет [PRODUCT.md](PRODUCT.md), [FLOWS.md](FLOWS.md), [UX-CONTRACT.md](UX-CONTRACT.md), [DECISIONS.md](DECISIONS.md). Платежи, settlement, commission, DRM-модели, payout и dispute timing — [COMMERCIAL-FUTURE.md](COMMERCIAL-FUTURE.md) (план) и исходные handbook-главы до DOC-04.

| Метка               | Значение                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------- |
| **Текущий runtime** | Что делает код / closed beta сейчас                                                       |
| **Цель владельца**  | Утверждённая цель; строить можно при поручении, но free beta не включает реальные платежи |
| **Предложение**     | Не утверждено к сборке без владельца                                                      |
| **Live unknown**    | Нужно свидетельство кода/CI/среды                                                         |

---

## 1. Границы предмета

- Первая коммерческая вертикаль — **MTA Scripts**; архитектура не навечно ограничена scripts, но первый paid depth — вокруг них (**цель**).
- **Коллекции и библиотека — не versioned server packs.** Приватные подборки организуют доступные ресурсы; snapshot/pack целого сервера — отдельное будущее направление ([PRODUCT.md](PRODUCT.md)).
- Free closed beta: **нет реальных платежей**, checkout/payout/DRM production не активируются. Цели license/access сохраняются как контракт, без включения commerce.
- Любой зарегистрированный пользователь может стать seller фактом публикации коммерческого продукта и принятия Seller/Publishing Agreement; отдельная обязательная seller application отсутствует. Verification — независимый evidence layer (**цель**).
- Workspace — единый адаптивный `/workspace`, не отдельные кабинеты ролей; после login **нет** авто-редиректа в dashboard (**цель**; навигация — [UX-CONTRACT.md](UX-CONTRACT.md)).

---

## 2. Модель продукта и выдачи

### 2.1 Editions и delivery (**цель**)

Один продукт может иметь Free / Premium edition, closed-code / open-source delivery, несколько license scopes, bundle membership, source-code premium variant.

| Режим       | DRM                          | Что видит покупатель                                                 |
| ----------- | ---------------------------- | -------------------------------------------------------------------- |
| Closed code | Seller opt-in enable/disable | Закрытая сборка; DRM Protected только если включено                  |
| Open source | Нет DRM                      | Явно: source + license model; source access может быть отдельным SKU |

Seller задаёт цену сам; искусственный minimum price нет (кроме provider limits). **Цена не trust signal.** Fake markdown pricing запрещён.

Скидки (**цель**, детали commerce → COMMERCIAL-FUTURE): seller discounts, coupons, promo codes, platform campaigns, bundles.

### 2.2 Что получает buyer до оплаты (**цель**)

Product page / каталог отвечают: что это, кто автор, что выдаётся, насколько можно доверять.

Above-the-fold (когда применимо): title; price/Free; seller/org; rating evidence; current version; Open/Closed Source; DRM Protected если включено; key compatibility/dependency summary; Add to Cart; Trial/Demo CTA; trust/security state последнего downloadable build. Карточки каталога тоже показывают Open/Closed Source и DRM Protected.

Media: screenshots, gallery, video, GIF, supported embeds, demo server/Join где уместно — по content/security правилам; arbitrary executable/embed code запрещён. Gallery уже есть в runtime; lightbox — **предложение** ([UX-CONTRACT.md](UX-CONTRACT.md)).

### 2.3 Compatibility и dependencies (**цель**)

Compatibility metadata **необязательна** для каждого продукта. Optional: MTA version, server OS, Lua/runtime, required modules, dependencies, tested versions, known conflicts. Опубликованное — структурированно, не только в description.

NEXUS **не обязан** автоматически вычислять incompatibility по конфигу привязанного сервера.

Dependency graph нужен независимо от полной compatibility: required / optional / bundled / external-manual + version constraint. Покупатель видит зависимости **до оплаты**. **Нельзя** автоматически класть платную dependency в cart без явного согласия.

---

## 3. Публикация и состояния каталога

### 3.1 Lifecycle (**цель**)

Рекомендуемый поток:

```text
DRAFT → READY_FOR_CHECKS → AUTOMATED_SAFETY_CHECKS → MANUAL_REVIEW → PUBLISHED
DRAFT → READY_FOR_CHECKS → AUTOMATED_SAFETY_CHECKS → PUBLISHED   (subscription auto-publish)
```

Auto-publish = bypass **только** manual queue; **никогда** не bypass malware / integrity / policy / storage safety / DRM-package validation where relevant / risk engine. Доступен лишь без active risk flags; staff может revoke с reason/audit/appeal.

Дополнительно: rejected; suspended; archived; retired; version deprecated.

Каталожные states (**цель**): `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `UNLISTED`, `QUARANTINED`, `SUSPENDED`, `ARCHIVED`, `TAKEDOWN`.

| State                            | Кто / правило                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UNLISTED`                       | Seller может включить сам                                                                                                                                    |
| `ARCHIVED` / `TAKEDOWN`          | Сохраняют purchase, license/entitlement, build/version, moderation/audit, dispute/support refs                                                               |
| Публичная archived/delisted page | Остаётся (если нет legal/security запрета): status, substantive reason, seller where allowed, latest safe metadata, **без purchase CTA**, guidance для buyer |

### 3.2 Publish Wizard (**цель**)

Full-page flow (не modal): Basic → Delivery → Files/Source → Dependencies → Media → Price/SKU → DRM → Support → Preview → Publish/Submit. Draft сохраняется по шагам. Open Source → no DRM; Closed → seller решает DRM. Checklist/preview **не** заменяют clean scanner result (**цель** + [UX-CONTRACT.md](UX-CONTRACT.md)).

### 3.3 KYC / eligibility (**цель**; деньги → COMMERCIAL-FUTURE)

- Draft/listing до KYC/provider onboarding разрешены.
- KYC/provider обязателен **до первой payout**; PSP/legal могут требовать раньше — implementation обязан уважать.
- Seller/Publishing Agreement до first paid publication/transaction по legal gate.
- Verified Seller не входной билет.

### 3.4 Organization products (**цель**)

`manage_products`: edit metadata, upload builds, releases, support, moderation responses. Payout/billing/tax/provider — только Owner/Finance + stronger re-auth/audit. Org — economic actor (resources + payouts, если provider/legal позволяет); детали → SERVERS-ORGS / COMMERCIAL-FUTURE.

### 3.5 Текущий runtime lifecycle

**Текущий runtime:** free publish/moderation path существует; restore archived и release suspended возвращают **draft**, не published ([FLOWS.md](FLOWS.md) FLOW-20). Paid publish/checkout **выключены**. Авторский readiness overview — **предложение**.

---

## 4. Версии, сканирование и публичная выдача

### 4.1 Инвариант публичного ресурса (не ослаблять)

**Публичная выдача файла требует:** допустимую **опубликованную** сборку **и** чистый результат сканирования с **идентификатором сканера** и **временем** проверки. Без этого — не `ready` и не downloadable public build.

Каждая версия (**цель**) хранит: immutable artifact identity; SHA-256/size; scan provenance; version number; changelog; compatibility/dependencies; publication/moderation history. Changelog/version history обязательны для коммерческого listing.

### 4.1a Human resource version compare (OPS-19 **A**)

Для **новых** релизов канон — SemVer-like `MAJOR.MINOR.PATCH[-pre]` (PATCH может быть опущен в принятом вводе; при сравнении отсутствует как `0`). Опциональный ведущий `v` снимается для compare и uniqueness; precedence как SemVer (prerelease ниже release). Duplicate version identity **не** создаёт вторую сборку продукта (`builds_product_version_idx` / `BUILD_VERSION_EXISTS`).

Поля остаются **раздельными** и не подменяют друг друга: build id; artifact hash/bytes; display app/product `version`; `mtaVersionTarget`; package evidence `schemaVersion`. Опубликованные исторические version strings и bytes **не** переписываются задним числом. Helpers: `@nexus/domain` (`compareResourceVersions`, `normalizeResourceVersionForStorage`, …) и `@nexus/validation` `resourceVersionSchema`.

### 4.2 Download API и historical releases (**текущий runtime**)

- `GET /api/products/:id/download` — latest safe published build.
- `GET /api/products/:id/download?buildId=bld_…` — конкретная **сейчас** safe сборка **того же** product; никогда storage key / user path.
- Сохраняются: auth, ownership/entitlement, publication, scan provenance, rate limits, size/hash metadata, audit.
- Unknown / retired / quarantined / unscanned / other-product → отказ. Duplicate/malformed buildId → 400.
- 200 объявляет фактический `X-Resource-Build-Id`; клиент не сохраняет pinned download при несовпадении.
- Публичный `/market/[slug]/versions`: только published + trusted-clean builds free published resource; 12-row SQL `created_at DESC, id DESC`; без storage keys / quarantine reasons; `noindex, nofollow`; RU/EN: recorded scan ≠ гарантия будущего доступа; signature flag ≠ verification.
- Кнопки library/detail — convenience, **не** authoritative grant. Версия может исчезнуть между render и click; текущая серверная авторизация важнее stale UI.
- UI download trust surface (**цель** / частично runtime): product/build/version, SHA-256, malware scan, scanner/provenance, signature/integrity if any, release timestamp, source/DRM model, quarantine warning.

**Live unknown / hardening:** гонка moderation между DB selection и object stream (нужен delivery lease / immutable revocation gate); независимая E2E проверка binary SHA-256 без trusted provider digest — later pass. CI/PostgreSQL подтверждение интеграционных тестов — по факту runner.

Сценарии latest vs pinned, progress/cancel/receipt — [FLOWS.md](FLOWS.md) §8; успех передачи ≠ установка.

### 4.3 Claim / получение free (**текущий runtime** + цель FLOW-01)

Бесплатный путь: `/acquire?productId=…` → сессия → claim → library/download. Auth return target и «Открыть библиотеку» → [FLOWS.md](FLOWS.md). Save / release watch / discussion follow — разные действия; watch требует current download access + published + safe build.

---

## 5. Библиотека и коллекции

### 5.1 Приватная библиотека прав (**текущий runtime**)

**Выбор версии:** запись через `POST /api/library/releases/:id` требует `X-Nexus-Actor-Id` исходного пользователя; клиенты API должны передавать этот заголовок. При неизвестном результате интерфейс сохраняет исходную команду в текущем экране для точного повтора.

Маршрут `/workspace/library` (замена полной загрузки всех entitlements/licenses в память):

| Правило                    | Содержание                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Выборка                    | Счётчик `all / ready / unavailable`, затем страница; порядок `MAX(grant.created_at) DESC, resource_id ASC`                 |
| Размер                     | ≤12 на странице; preview кабинета ≤4                                                                                       |
| Право `product.download`   | Действующие user entitlements с permission **или** исторические активные licenses с неистёкшим сроком; дубли → одна строка |
| Не создают карточку        | Отозванные / suspended / expired licenses; expired entitlements; права `product.update`                                    |
| `ready`                    | Опубликованный продукт **и** ≥1 опубликованная сборка с `clean`-сканом, именем сканера и временем                          |
| Недоступный ранее acquired | Остаётся в private library **без** утечки title/slug/version/download                                                      |
| Historical paid            | Только при действующем праве; **не** открывает checkout                                                                    |
| `ready` label              | Подсказка, **не** авторизация: download снова проверяет session, права, статус, trusted scan, audit                        |
| Локализация / SEO          | RU/EN; robots noindex                                                                                                      |

Коммерческие платежи, DRM и выдача **новых** платных лицензий этим контуром **не** реализуются.

### 5.2 Целевые режимы Buyer Library (**цель**)

`Purchased` / `Free` (claimed) / `Trials` / `Licenses` / `Updates` / `Support` / `Invoices`. Фильтры: type, seller, server binding, DRM, updates, access expiration. Каждый item показывает availability и reason при restriction.

### 5.3 Коллекции (**текущий runtime**; сценарий → FLOWS FLOW-07)

Приватные: лимиты 30 collections / 200 items / batch 20. Добавление ≠ watch; архив коллекции ≠ отзыв доступа. Public/shared collections не подразумеваются. **Не** versioned server pack.

`POST /api/library/collections` требует `X-Nexus-Actor-Id` с ID исходного аккаунта; отсутствие заголовка даёт 428, смена аккаунта — 409. Create и duplicate сохраняют исходный `requestId` и команду в хранилище текущей вкладки для точного повтора после неопределённого ответа; без доступного хранилища отправка не начинается.

### 5.4 Read-only historical archive (**текущий runtime**)

Authenticated, `noindex`; без изобретения payment/payout/invoice/DRM provider:

| Маршрут                | Что видно                                         | Чего нет                                                             |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `/workspace/purchases` | Historical order numbers, statuses, dates, totals | Payment tokens, emails, private provider data                        |
| `/workspace/licenses`  | Titles, expiration, model, boolean server-binding | Secret keys, entitlement JSON, server IDs; `Active` ≠ download grant |
| `/workspace/sales`     | Completed line items автора; gross line prices    | Buyer identity; withdrawable balance / fees / payout auth            |

Ownership predicates + 20-row `created_at, id` DESC. Это **не** target cart/purchase workflow.

---

## 6. Лицензии, доступ после продажи и retention

> Commerce checkout/payment/settlement → [COMMERCIAL-FUTURE.md](COMMERCIAL-FUTURE.md). Здесь — права доступа к ресурсу.

**Текущий API управления:** изменения лицензии и чтение доступных серверов требуют `X-Nexus-Actor-Id` исходного пользователя. Одноразовый runtime token показывается только в текущем экране и очищается при потере фокуса или скрытии вкладки; потерянный ответ с токеном не восстанавливается. Это не включает платный checkout.

### 6.1 License scope (**цель**, OWNER)

**Одна лицензия = один MTA server.** Несколько серверов → отдельные license units. Unlimited/multi-server SKU не default без отдельного owner decision.

Покупка **до** server binding. Unbound paid license: **30-дневное activation window** → иначе `activation_expired` (не авто-refund). Уведомления **7 / 3 / 1** день до конца окна. Срок окна ≠ договорный срок уже активированной лицензии.

Trial (**цель**): seller-enabled, не обязателен; отдельный от Purchase; срок; server binding; download/activation limits; DRM lease если включён; conversion path; anti-abuse; visibly ≠ paid ownership; не становится permanent простым recreate.

Wishlist (**цель**): notifications о discount / new version / availability / Free↔Premium / seller announcement (opt-in); не purchase intent; не влияет на trust/reviews.

Support term (**цель**): отдельное право от ownership/update; product page до покупки показывает срок, состав, response expectations, канал unified support.

Update entitlement (**цель**): будущие updates бесплатно по умолчанию в той же product/SKU/license family при active entitlement, пока seller не меняет scope через прозрачную migration.

### 6.2 Delist / seller-ban / free retention (**цель**, OWNER)

| Случай                  | Правило                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Добровольный delist     | Новые purchases stop; buyers видят status/reason; **30 дней** download/access window; после — permanent redownload **не гарантируется**; правило видно buyer **до оплаты** и seller **до confirm**            |
| Seller ban              | Good-faith buyers: 30-day transition; payout/dispute freeze по policy; malware/legal может закрыть download сразу; notification насколько позволяет safety/legal                                              |
| Delist freeze releases  | В 30-day window seller **не** выпускает security hotfix обычным release flow; критичный дефект → platform security/moderation                                                                                 |
| DRM после окна          | 30 дней = hosting/redownload, **не** авто-обрыв уже активированной DRM-license; perpetual не получает искусственный expiry от delist; time-limited/subscription до оплаченного конца; malware/legal supersede |
| Existing copies         | NEXUS может прекратить hosting; не заявляет «удаление» уже скачанных binaries у пользователя                                                                                                                  |
| Free resource retention | Safe free **не обязан** удаляться через 30 дней только из-за paid policy; дольше при отсутствии malware/legal, допустимой storage policy, валидных provenance/scan, ясном archived/unsupported UI             |

### 6.3 Reviews (**цель**)

Paid review → confirmed purchase. Free → confirmed claim/acquisition. Update review после новой версии с историей/last-updated; seller не «обнуляет» feedback релизом. Отказы/исключения автора — [FLOWS.md](FLOWS.md) FLOW-18.

### 6.4 Cart / checkout (**цель**; не runtime paid)

Multi-item cart; guest cart = convenience (цены не reservation); checkout требует login + verified email; server revalidates всё перед payment intent; invalid item объясняется явно (не silent price change/remove). Order → per-item Purchase/License. Webhook не создаёт доступ без idempotent domain transition. Offline/PWA: cached library metadata ok; payment/activation/transfer **blocked** с ясным Offline.

**Текущий runtime:** paid checkout disabled.

---

## 7. Workspace: buyer и seller экраны

### 7.1 Workspace navigation (**цель**)

Overview / Library·Purchases / Resources / Servers / Organizations / Deals·Services / Support / Billing·Subscriptions / Security shortcuts / Staff surfaces. Нет доступа → скрыть или честный onboarding CTA. Overview = actionable only, не копия Home.

### 7.2 Buyer landing / purchase detail (**цель**)

Landing: recent purchases; licenses waiting activation; updates; support/dispute; wishlist changes; invoices where supported.

Purchase detail tabs: Overview / Downloads / License / Updates / Support / Invoice / Dispute — order identity, SKU, paid amount, entitlement, binding, DRM/lease, update history, support term, receipt, dispute, 30-day transition notice. Client success ≠ server purchase/license state.

### 7.3 Seller dashboard / products / analytics (**цель**)

KPI: Revenue / Pending / Sales / Conversion / Refunds. Product Health, action queue, support/disputes, moderation, releases, promotions, subscription, payout/KYC.

Products table: Status / Version / Price / Sales / Rating / Support / DRM / Last update / Risk.

Analytics: date range, product compare, funnel view→cart→purchase, revenue, refunds, downloads, version adoption; geography только privacy-safe; без лишнего buyer PII; operational facts ≠ estimated attribution.

Promotions manager (**цель**): boosts/featured/schedule; sponsored явно labelled; не переписывает organic rank тайно (реклама → UX / COMMERCIAL-FUTURE).

Seller support: unified inbox; subscription может дать **операционный** приоритет NEXUS-обработки; **никогда** не покупает dispute/moderation outcome, verification/trust, security bypass. Среднее response time **не обязательно** публичный reputation signal.

Delist/archive UX: unlist доступен; history/buyer records survive; public page с reason без purchase CTA.

### 7.4 Trust presentation на product page (**цель**)

Различать отдельно: seller verification; product moderation; build malware-scan; source model; DRM; verified purchase reviews; update recency; delist/archive. **Не** сводить к одному badge `Trusted`.

---

## 8. Отказы и non-goals (ресурсы)

Не начинать first commerce с: custom crypto custody; самодельный wallet без legal need; сложный ad auction; dozens unrelated categories; DRM с per-customer recompilation (commerce non-goals → COMMERCIAL-FUTURE).

Не делать:

- отдельные accounts Buyer/Seller/Server Owner;
- dashboard redirect после каждого login;
- finance/admin widgets без permission;
- role-frontend, несовместимый с multi-role;
- subscription ≡ trust/verification;
- молчаливую подмену цены/SKU/build;
- выдачу без published + clean scan (scanner id + time);
- объявление коллекций versioned server packs;
- активацию real payments в free closed beta.

---

## 9. Сводка статусов

| Тема                                   | Текущий runtime                | Цель владельца                        | Предложение / Live unknown                 |
| -------------------------------------- | ------------------------------ | ------------------------------------- | ------------------------------------------ |
| Free claim, library, download gates    | Да                             | Усиление UX FLOW-01/17                | Auth return gaps — FLOWS                   |
| Historical versions + pinned download  | Да                             | Сохранить gates                       | Read/stream race; E2E hash — live unknown  |
| Private collections                    | Да (private only)              | FLOW-07 UX                            | Public/shared, server packs — нет / future |
| Paid cart/checkout/DRM/payout          | Выключено                      | Полный lifecycle + 1 license=1 server | Не строить без owner + COMMERCIAL gates    |
| Publish wizard / auto-publish / KYC UX | Частичный free path            | Полный wizard + states                | Readiness overview — предложение           |
| Buyer/Seller professional dashboards   | Overview/library/sales archive | Полный KPI/analytics set              | Org-wide finance roles — future            |
| Trial / Wishlist / multi-SKU           | Нет в beta commerce            | Owner-confirmed                       | Активация только с commerce phase          |

---

## 10. Источники и авторитет

Перенесённый смысл (resource/library/publishing/access):

1. [handbook/23-MARKETPLACE-PRODUCT-LIFECYCLE.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/23-MARKETPLACE-PRODUCT-LIFECYCLE.md) (история; актуальный контракт — этот файл)
2. [handbook/28-CART-LICENSES-AND-ACCESS-RIGHTS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/28-CART-LICENSES-AND-ACCESS-RIGHTS.md) (история; актуальный контракт — этот файл) — resource/access; commerce → COMMERCIAL-FUTURE
3. [handbook/33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/33-WORKSPACE-DASHBOARDS-AND-LIBRARY.md) (история; актуальный контракт — этот файл)
4. [handbook/34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/34-PRODUCT-PAGE-DEPENDENCIES-AND-DELIVERY.md) (история; актуальный контракт — этот файл)
5. [handbook/39-SELLER-PUBLISHING-KYC-AND-CATALOG-STATES.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/39-SELLER-PUBLISHING-KYC-AND-CATALOG-STATES.md) (история; актуальный контракт — этот файл)
6. [handbook/46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/46-BUYER-CART-PURCHASE-LIBRARY-SCREENS.md) (история; актуальный контракт — этот файл)
7. [handbook/47-SELLER-CREATOR-SCREENS.md](https://github.com/acc-holo-dev/mta-nexus-site/blob/385e577e7443cf7d7b817419ce5c3b8afe87b690/docs/handbook/47-SELLER-CREATOR-SCREENS.md) (история; актуальный контракт — этот файл)

Смежные контракты без дублирования: [PRODUCT.md](PRODUCT.md), [FLOWS.md](FLOWS.md), [UX-CONTRACT.md](UX-CONTRACT.md), [DECISIONS.md](DECISIONS.md) + [handbook/13-DECISION-REGISTER.md](handbook/13-DECISION-REGISTER.md).

**Пока DOC-04 не завершён, исходные главы handbook остаются авторитетными** при любом расхождении с этим черновиком. Этот файл — интегрированный DOC-05 draft subject contract, не разрешение удалять handbook и не активация commerce.

Resource creation (`POST /api/products`) and build submission (`POST /api/products/:id/builds`) require `X-Nexus-Actor-Id` matching the authenticated session. Missing headers return 428; changed accounts return 409. Clients must keep the original actor and exact submission when a response is lost. The author form keeps an actor-scoped pending intent and requires the same filename and SHA-256 after a reload; an exact retry can recover the existing draft or pending build. A failed recovery attempt, including rate limiting, does not establish that an earlier request failed.
