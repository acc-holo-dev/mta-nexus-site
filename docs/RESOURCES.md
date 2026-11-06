# Ресурсы, библиотека и публикация

**Статус:** living · предметный контракт (ресурсы / библиотека / публикация).  
**База DOC-05:** `385e577e7443cf7d7b817419ce5c3b8afe87b690`.  
**Не активирует** платежи, payout, production DRM. Commerce-цели — [COMMERCIAL-FUTURE](COMMERCIAL-FUTURE.md). UI/сценарии — [UX-CONTRACT](UX-CONTRACT.md), [FLOWS](FLOWS.md).

| Метка | Значение |
| ----- | -------- |
| **Текущий runtime** | Код / free beta сейчас |
| **Цель** | Утверждено владельцем; free beta не включает реальные платежи |
| **Предложение** | Не строить без поручения |
| **Live unknown** | Нужно свидетельство среды/CI |

## Цель

Контракт каталога ресурсов, версий/сборок, выдачи файла, приватной библиотеки, коллекций и seller-публикации. Первая коммерческая вертикаль — **MTA Scripts** (**цель**); архитектура не навечно только scripts. Коллекции/библиотека **не** versioned server packs ([SERVER-PACK-SPEC](SERVER-PACK-SPEC.md)).

## Акторы и права

| Актор | Права / ожидание |
| ----- | ---------------- |
| Гость / покупатель | Каталог, карточка, после входа — claim/library/download по правам |
| Автор / seller | Публикация free path сейчас; paid listing — **цель** после commerce gates |
| Org с `manage_products` | Metadata/builds/releases/support (**цель**); finance/payout — Owner/Finance + re-auth |
| Staff | Модерация, quarantine, revoke с reason/audit/appeal |
| Любой зарегистрированный | Может стать seller фактом публикации + Seller Agreement (**цель**); verification — отдельный evidence layer |

Workspace — единый `/workspace`, без auto-redirect в dashboard после login (**цель**).

## Happy path (runtime free)

| Путь | Завершение |
| ---- | ---------- |
| Каталог → карточка | Автор, описание, доступность; ошибка ≠ пусто ≠ unknown online |
| `/acquire?productId=` → claim → library | Сессия + entitlement; Save / release watch / discussion follow — разные действия |
| Download latest / pinned | Published + clean scan; клиент сверяет `X-Resource-Build-Id` |
| Коллекции | Private only; add ≠ watch; архив ≠ отзыв доступа |
| Historical archive | Purchases/licenses/sales — read-only facts без provider secrets |

Сценарии latest vs pinned, receipt, FLOW-01/07/17/18/20 — [FLOWS](FLOWS.md).

## Инварианты публичной выдачи (не ослаблять)

Публичная выдача файла требует:

1. допустимую **опубликованную** сборку, и  
2. чистый результат сканирования с **идентификатором сканера** и **временем**.

Иначе сборка не `ready` и не downloadable public build.

### Download API (**текущий runtime**)

- `GET /api/products/:id/download` — latest safe published build.
- `GET /api/products/:id/download?buildId=bld_…` — конкретная **сейчас** safe сборка того же product; никогда storage key / user path.
- Unknown / retired / quarantined / unscanned / other-product → отказ. Bad `buildId` → 400.
- 200 объявляет фактический `X-Resource-Build-Id`; несовпадение → клиент не пинит download.
- `/market/[slug]/versions`: только published + trusted-clean; ≤12 rows; `noindex`; без storage keys / quarantine reasons.
- Кнопки UI — convenience, не authoritative grant. Успех передачи ≠ установка.

**Live unknown:** гонка moderation между DB selection и object stream; независимая E2E SHA-256 без trusted digest.

### Version compare (OPS-19 **A**)

Новые релизы: SemVer-like `MAJOR.MINOR.PATCH[-pre]` (PATCH может опускаться → `0` при compare). Ведущий `v` снимается. Duplicate version identity не создаёт вторую сборку (`BUILD_VERSION_EXISTS`). Поля раздельно: build id, artifact hash/bytes, display version, `mtaVersionTarget`, package `schemaVersion`. Исторические published strings/bytes не переписываются. Helpers: `@nexus/domain` / `@nexus/validation`.

### Actor binding на write

`POST /api/products`, builds, library releases/collections, license control требуют `X-Nexus-Actor-Id` исходного пользователя. Нет заголовка → 428; смена аккаунта → 409. Клиент хранит exact retry после неопределённого ответа.

## Библиотека и коллекции (**текущий runtime**)

| Правило | Содержание |
| ------- | ---------- |
| `/workspace/library` | Счётчик `all/ready/unavailable`, страница ≤12; preview ≤4; порядок `MAX(grant.created_at) DESC, resource_id` |
| Право `product.download` | User entitlements **или** активные неистёкшие licenses; дубли → одна строка |
| Не карточка | Revoked/suspended/expired licenses; expired entitlements; `product.update` |
| `ready` | Published product **и** ≥1 published build с clean-сканом (scanner id + time) |
| Недоступный acquired | Остаётся без утечки title/slug/version/download |
| Коллекции | ≤30 collections / ≤200 items / batch ≤20; private only; не server pack |
| Archive routes | `/workspace/purchases|licenses|sales` — ownership + 20-row page; без payment tokens / secret keys / buyer PII на sales |

`ready` label — подсказка, не авторизация. Paid checkout этим контуром **не** реализуется.

## Публикация (**цель** + runtime)

**Runtime:** free publish/moderation path есть; restore archived / release suspended → **draft**, не published (FLOW-20). Paid publish/checkout выключены.

**Цель lifecycle:**

```text
DRAFT → READY_FOR_CHECKS → AUTOMATED_SAFETY_CHECKS → MANUAL_REVIEW → PUBLISHED
DRAFT → … → AUTOMATED_SAFETY_CHECKS → PUBLISHED   (subscription auto-publish)
```

Auto-publish обходит **только** manual queue; никогда malware/integrity/policy/storage/DRM-package/risk. States: `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `UNLISTED`, `QUARANTINED`, `SUSPENDED`, `ARCHIVED`, `TAKEDOWN`. `UNLISTED` — seller сам; archive/takedown сохраняют purchase/license/build/audit refs.

Publish Wizard (**цель**): full-page Basic → … → Preview → Submit; Open Source → no DRM. Checklist ≠ clean scanner.

KYC (**цель**): draft до KYC ок; KYC обязателен до первой payout; Seller Agreement до first paid publication.

## Editions, license, cart (**цель**; не runtime paid)

| Тема | Правило владельца |
| ---- | ----------------- |
| Editions | Free/Premium; closed/open delivery; несколько scopes/SKU |
| DRM | Seller opt-in на closed; open source — без DRM; цена ≠ trust |
| Dependencies | Graph до оплаты; нельзя авто-класть платную dep в cart |
| License scope | **1 лицензия = 1 MTA server**; unbound paid: 30-day activation window |
| Delist / seller-ban | Новые покупки stop; good-faith buyers — 30-day redownload window (malware/legal may cut sooner) |
| Free retention | Safe free не обязан удаляться через 30 дней только из-за paid policy |
| Reviews | Paid → confirmed purchase; free → claim; seller не обнуляет feedback релизом |
| Cart | Multi-item; guest cart ≠ reservation; checkout = login + verified email; webhook без idempotent domain transition не создаёт доступ |

Trial / wishlist / support term / update entitlement — **цель**; детали commerce → [COMMERCIAL-FUTURE](COMMERCIAL-FUTURE.md).

## Trust на product page (**цель**)

Раздельно: seller verification; product moderation; build malware-scan; source model; DRM; verified reviews; update recency; delist/archive. **Не** один badge `Trusted`.

## Ошибки и non-goals

Не делать:

- выдачу без published + clean scan (scanner id + time);
- отдельные accounts Buyer/Seller/Server Owner;
- dashboard redirect после каждого login;
- subscription ≡ trust/verification;
- молчаливую подмену цены/SKU/build;
- коллекции как versioned server packs;
- реальные платежи в free beta;
- custom crypto custody / ad auction как first commerce.

## Сводка runtime vs цель

| Тема | Runtime | Цель |
| ---- | ------- | ---- |
| Free claim, library, download gates | Да | UX FLOW-01/17 |
| Historical + pinned download | Да | Сохранить gates |
| Private collections | Да | FLOW-07 UX |
| Paid cart/checkout/DRM/payout | Выкл. | Lifecycle + 1 license=1 server |
| Publish wizard / KYC | Частичный free path | Полный wizard + states |
| Trial / Wishlist / multi-SKU | Нет | С commerce phase |

## Связь с кодом и источниками

Код: `product-service`, `build-*`, `library-*`, download routes, ClamAV. Архитектура storage/scanner — [ARCHITECTURE](ARCHITECTURE.md). Ops — [OPERATIONS](OPERATIONS.md).

Исторический смысл DOC-05 (главы 23/28/33/34/39/46/47) — в Git @ `385e577e…`. Актуальный контракт — этот файл после DOC-04.
