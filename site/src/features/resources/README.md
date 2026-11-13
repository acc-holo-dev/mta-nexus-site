# Resources: публичные страницы, UI и модели

Read-only срез объединяет composition каталога, detail, публичной истории версий и
отзывов, карточку, preview/gallery, build provenance/package evidence и чистые
query/gallery/provenance helpers. Остальной detail/review UI, editor, builds,
download handlers и Q&A остаются в существующих модулях.
Services и repositories не дублируются и не переносятся.

## Публичные entrypoints

| Entry                | Контракт                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `detail-view.ts`     | `ProductDependencyList`; общее представление зависимостей для detail и workspace                            |
| `review-controls.ts` | `ResourceReviewEditor`, `ResourceReviewDecisionForm`; клиентские формы для library и moderation             |
| `reviews-view.ts`    | `ResourceReviewPager`; общая пагинация для workspace                                                        |
| `download.ts`        | `ResourceDownloadButton`; отдельный клиентский контракт для detail, versions и library                      |
| `client.ts`          | `ResourcePreview`, `ResourceGallery`, `ResourceQaPanel`; client components                                  |
| `evidence.ts`        | `BuildProvenanceDetails`, `BuildPackageSummaryPanel`, `BuildPackageEvidencePanel`; RSC/client-compatible UI |
| `view.ts`            | `ProductCard`, совместимая с RSC и Discovery                                                                |
| `server.ts`          | `MarketPage`, Next `server-only` composition с request locale и существующим product service                |
| `detail-server.ts`   | `ProductDetailPage`, отдельный Next `server-only` composition с session/visibility/access hydration         |
| `versions-server.ts` | `PublicResourceVersionsPage`, публичные safe releases и session-aware download affordance                   |
| `reviews-server.ts`  | `PublicResourceReviewsPage`, публичная пагинация отзывов и guest/auth links                                 |
| `model.ts`           | Query/pagination, gallery interaction и build provenance; только pure domain dependency                     |

`view` и `evidence` не добавляют `use client`; их компоненты сохраняют RSC/client
совместимость. `client` экспортирует preview/gallery с прежними client directives;
lightbox остаётся приватным. Общие locale, безопасные preview URLs и public attribution
остаются в lib, общий native-dialog hook — в components. Внутри feature используются
прямые implementation imports; workspace/media/build/library используют public ports.
Внешний production-код использует только entrypoints; приватные implementation
imports, feature→routing и client/evidence/view/model→server/services/infra запрещены анализатором.
Model также не импортирует app helpers, UI, frameworks или Node builtins. Negative
fixtures проверяют value/type edges; реальные графы client/evidence/view/model проверяются отдельно.

`server.ts` отвечает только за каталог; `detail-server.ts` — только за детальную
страницу. Они не реэкспортируют друг друга: SSR hydration сессии, entitlement,
reviews/Q&A и follow/mute не добавляется к графу каталога. `versions-server.ts` и
`reviews-server.ts` также изолированы: ни один из четырёх server entrypoints не
загружает composition остальных страниц. Boundary suite проверяет эту независимость,
защиту `server-only` и запрет value/type server leaks в view.

Metadata и dynamic config детальной страницы остаются в App Router. Feature
сохраняет прежние session/service/repository calls и их порядок: private preview,
manager authority, clean-build provenance, entitlement, gallery, Save/mute/watch,
Q&A deep link и paid-disabled state не меняются. UI-проекции не авторизуют выдачу:
claim/download HTTP services по-прежнему повторно проверяют доступ на сервере.

История версий сохраняет прежнюю public-product проверку перед build query,
trusted-clean SQL selection, pagination, provenance и точный buildId кнопки download.
Страница отзывов сохраняет public visibility, pagination, legacy evidence, ошибки
и вход к авторской задаче. Metadata обеих страниц и dynamic config остаются в routes;
у версий сохраняется `noindex/nofollow`. Loading shells остаются прежними.

Preview сохраняет URL validation, failed decode/cached error fallback и прежний
priority. Gallery сохраняет native links/modifier clicks, bounded navigation,
RU/EN captions, native modal/focus/keyboard и fallback при ошибке изображения.
Provenance/package evidence сохраняют различие clean/unknown/error/malicious,
scanner/time, legacy/truncated/unchecked, signature flag и verification. Pure
provenance projection не заменяет server download policy и не создаёт новый grant.

## Сохраняемое поведение

- App Router сохраняет `/market` и `dynamic = "force-dynamic"`; GET products API
  сохраняет parsing/status/headers/service, используя чистый model entry.
- SQL visibility, published/trusted-clean scan policy, attribution и доступ остаются
  в единственных существующих service/repository implementations.
- Search/category/sort/pagination, RU/EN, empty/end/error recovery, ссылки и карточки
  сохраняются без изменения UI и бесплатной модели каталога.
- Проверки: `pnpm test:catalog` с disposable PostgreSQL, tests карточки/preview и
  потребителей, architecture и полный CI, включая publishing/download browser.

Detail checks: `pnpm test:resource-integrity`, acquisition UI loading/surface,
metadata safety и management-authority/honesty tests. Source-reading guards читают
фактический feature implementation, behavior tests по-прежнему входят через route.

History/reviews checks: public release page/query и PostgreSQL integration,
review page/repository/lifecycle/browser-boundary, `pnpm test:resource` и pinned
download HTTP. Все behavior tests продолжают входить через маршруты App Router.

Presentation checks: preview/card/gallery, trust/provenance/package UI и honesty
source guards, detail/versions/media consumers; PostgreSQL package-evidence и media
lifecycle integrations. Состав suites сохранён после одного rename preview test.

Boundary suite — `scripts/tests/resources-feature-boundaries.node-test.mjs`.
Изменения feature требуют полного CI. Download authority, commerce и DRM не меняются.

Review list/pager, review controls, Q&A panel и report form принадлежат Resources.
Общий confirmAction, HTTP adapters, service и repository остаются прежними.

Dependency/reverse-dependency, variants и version-help UI принадлежат Resources.
`detail-view` предоставляет dependency UI workspace; чистые resolution helpers и
shared copy/support components сохраняют прежние места. Списки не меняют server visibility.

Download UI принадлежит Resources и экспортируется через отдельный client port.
Сетевой adapter, pin/hash/size/cancellation policy и authoritative HTTP/service
checks сохраняют прежние реализации; UI не является разрешением на выдачу.
Проверки: `pnpm test:resource-integrity`, consumers library/detail/versions и
полный browser acceptance с exact-byte download, timeout и cancellation.
