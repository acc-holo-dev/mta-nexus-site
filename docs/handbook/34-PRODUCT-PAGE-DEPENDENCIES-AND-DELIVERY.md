# MTA NEXUS — Product Page, Dependencies и Delivery

> Статус: OWNER DECISION / TARGET SPEC.

## 1. Карточка и product page

Marketplace должен быстро отвечать на четыре вопроса: **что это, кто автор, что именно я получаю и насколько этому можно доверять**.

Above-the-fold product page показывает, когда данные применимы:

- title;
- price / Free;
- seller или organization;
- rating/review evidence;
- current version;
- Open Source / Closed Source;
- DRM Protected, если включено;
- key compatibility/dependency summary, если seller указал эти данные;
- `Add to Cart`;
- Trial/Demo CTA, если доступен;
- trust/security state последнего downloadable build.

Каталожные карточки также явно показывают `Open Source`, `Closed Source` и `DRM Protected`, чтобы buyer не узнавал licensing model только после открытия страницы.

## 2. Media

Seller может использовать rich media:

- screenshots;
- gallery;
- video;
- GIF/animated preview;
- supported video embeds;
- demo server link/Join CTA where relevant.

Media проходит обычные content/security правила и не должна позволять arbitrary executable/embed code.

## 3. Compatibility

OWNER DECISION: compatibility metadata **не является обязательным полем для каждого продукта**.

Допустимые optional fields:

- MTA version;
- server OS;
- Lua/runtime assumptions;
- required modules;
- dependencies;
- tested versions;
- known conflicts.

Если seller эти данные публикует, NEXUS должен отображать их структурированно, а не прятать только в description.

OWNER DECISION: NEXUS **не обязан автоматически вычислять incompatibility** на основе конфигурации привязанного сервера. Не строить ложную compatibility intelligence без надёжных данных.

## 4. Dependency graph

Dependency graph нужен независимо от того, обязательна ли полная compatibility metadata.

Resource может объявлять:

```text
Resource A
  -> requires Resource B >= 2.0
  -> requires Library C
  -> optional Integration D
```

Покупатель видит dependencies **до оплаты**. Система различает:

- required dependency;
- optional dependency;
- bundled dependency;
- external/manual dependency;
- version constraint.

Нельзя автоматически добавлять платную dependency в cart без явного согласия пользователя.

## 5. Delivery models

Подтверждены две основные модели:

### Closed Source

Seller выдаёт закрытую сборку. DRM включается seller opt-in.

### Open Source

Buyer получает source artifact в соответствии с купленной лицензией. DRM для open-source delivery не применяется.

Source access может быть отдельным более дорогим SKU.

## 6. Delist freeze

OWNER DECISION: после delist product считается frozen для новых releases. Seller **не выпускает security hotfix через обычный product release flow** в 30-дневное transition window.

Если после delist найден критический security defect, дальнейшее действие проходит через platform security/moderation process, а не как обычный коммерческий update.

Это уменьшает риск того, что снятый/заблокированный seller использует transition window для доставки нового неизвестного кода.

## 7. DRM после delist / seller ban

30-дневное правило относится к hosting/redownload availability, но **не обрывает уже легально активированную DRM-license автоматически на 30-й день**.

OWNER DECISION: активная DRM license продолжает работать **до окончания её договорного оплаченного срока**.

Следствия:

- time-limited license работает до своего expiry;
- subscription-bound license работает до конца оплаченного entitlement;
- если SKU юридически является perpetual license, delist сам по себе не создаёт искусственный expiry; отдельный malware/legal/security revocation остаётся возможным по policy;
- новые downloads после retention window могут быть недоступны;
- malware/legal takedown может supersede обычный срок.

## 8. Free resource retention

OWNER DECISION: safe free resource не обязан удаляться через 30 дней только потому, что paid delist policy использует 30-дневное окно.

Платформа может сохранять безопасные free builds дольше, если:

- нет malware/legal reason;
- storage/retention policy это допускает;
- provenance и scan metadata остаются валидными;
- UI ясно показывает archived/delisted/unsupported status.

## 9. Support relation

Support является общей NEXUS-системой. Любой пользователь может задать pre-sale вопрос, а также писать seller в разрешённых messaging surfaces.

Seller subscription может давать **операционный приоритет обработки его обычных support requests со стороны NEXUS**, но никогда:

- преимущество в dispute outcome;
- преимущество в moderation decision;
- покупку verification/trust;
- обход evidence/security policy.

OWNER DECISION: среднее seller response time/support satisfaction **не обязано быть публичным reputation signal**.

## 10. Trust presentation

Product page должен различать:

- seller verification;
- product moderation state;
- build malware-scan state;
- source model;
- DRM state;
- verified purchase reviews;
- update recency;
- delist/archive status.

Не сводить всё к одному badge вроде `Trusted`.

## 11. Closed-beta historical releases and pinned downloads (implementation)

A new public-safe, dynamic `/market/[slug]/versions` page lists only
currently **published** and **trusted-clean-scanned** builds of a published,
free resource. Its 12-row SQL pagination is deterministic by
`created_at DESC, id DESC`; malformed page inputs reset to page one.
The query projection excludes storage keys, quarantine reasons and other
private moderation data. Page metadata uses `noindex, nofollow`. RU/EN
messages distinguish recorded scan provenance from any guarantee of
future access; a recorded signature flag is **not** signature verification.

The download URL remains the same protected API:
`GET /api/products/:id/download` selects the latest safe published build.
`GET /api/products/:id/download?buildId=bld_...` selects a specific
currently safe build of **that same product**, never a storage key or
user-supplied file path. Authentication, current ownership/entitlement,
resource publication, scan provenance, rate limits, storage size/hash
metadata and required audit are preserved. Unknown, retired, quarantined,
unscanned and other-product IDs cannot deliver content. Duplicate or
malformed build IDs are rejected with 400. A 200 download declares its
actual `X-Resource-Build-Id`; the client refuses to save a pinned download
if this does not exactly match the requested build.

The library and resource-detail pages link to the release archive. Buttons
are convenience controls for currently entitled users and managers, *not*
authoritative grants. A version may disappear or be blocked between
render and click. Current download authorization takes precedence over
the page's stale state. Legacy paid checkout stays disabled.

Outstanding: a build may be moderated between DB selection and opening
the object stream; remove this read/stream race through a delivery lease or
immutable revocation gate before calling this path race-free. Binary SHA-256
from remote storage without trusted provider digest metadata also requires
end-to-end independent verification in a later hardening pass.
