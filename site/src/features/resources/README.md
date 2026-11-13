# Resources: каталог и detail composition

Read-only срез объединяет composition `/market` и `/market/[slug]`, общую карточку
ресурса и чистый разбор query/pagination. Detail UI components, editor, builds,
download handlers, Q&A и reviews остаются в существующих модулях. Services и
repositories не дублируются и не переносятся.

## Публичные entrypoints

| Entry              | Контракт                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `view.ts`          | `ProductCard`, совместимая с RSC и Discovery                                                        |
| `server.ts`        | `MarketPage`, Next `server-only` composition с request locale и существующим product service        |
| `detail-server.ts` | `ProductDetailPage`, отдельный Next `server-only` composition с session/visibility/access hydration |
| `model.ts`         | Query parsing, ссылки, размер и предел страницы; только pure domain dependency                      |

`view` не добавляет `use client`: карточка сохраняет прежнюю семантику, а интерактивный
`ResourcePreview` остаётся общим client component. Общие locale, безопасные preview
URLs, labels и public attribution остаются в lib/components для остальных consumers.
Внешний production-код использует только entrypoints; приватные implementation
imports, feature→routing и view/model→server/services/infra запрещены анализатором.
Model также не импортирует app helpers, UI, frameworks или Node builtins. Negative
fixtures проверяют value/type edges; реальный view/model graph проверяется отдельно.

`server.ts` отвечает только за каталог; `detail-server.ts` — только за детальную
страницу. Они не реэкспортируют друг друга: SSR hydration сессии, entitlement,
reviews/Q&A и follow/mute не добавляется к графу каталога. Boundary suite проверяет
эту независимость, защиту обоих server-only entrypoints и запрет detail leaks в view.

Metadata и dynamic config детальной страницы остаются в App Router. Feature
сохраняет прежние session/service/repository calls и их порядок: private preview,
manager authority, clean-build provenance, entitlement, gallery, Save/mute/watch,
Q&A deep link и paid-disabled state не меняются. UI-проекции не авторизуют выдачу:
claim/download HTTP services по-прежнему повторно проверяют доступ на сервере.

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

Boundary suite — `scripts/tests/resources-feature-boundaries.node-test.mjs`.
Изменения feature требуют полного CI. Download authority, commerce и DRM не меняются.
