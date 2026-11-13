# Resources: публичный каталог

Read-only срез объединяет composition `/market`, общую карточку ресурса и чистый
разбор query/pagination. Detail, editor, builds, download, Q&A и reviews остаются
в существующих модулях. Services и repositories не дублируются и не переносятся.

## Публичные entrypoints

| Entry       | Контракт                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- |
| `view.ts`   | `ProductCard`, совместимая с RSC и Discovery                                                 |
| `server.ts` | `MarketPage`, Next `server-only` composition с request locale и существующим product service |
| `model.ts`  | Query parsing, ссылки, размер и предел страницы; только pure domain dependency               |

`view` не добавляет `use client`: карточка сохраняет прежнюю семантику, а интерактивный
`ResourcePreview` остаётся общим client component. Общие locale, безопасные preview
URLs, labels и public attribution остаются в lib/components для остальных consumers.
Внешний production-код использует только entrypoints; приватные implementation
imports, feature→routing и view/model→server/services/infra запрещены анализатором.
Model также не импортирует app helpers, UI, frameworks или Node builtins. Negative
fixtures проверяют value/type edges; реальный view/model graph проверяется отдельно.

## Сохраняемое поведение

- App Router сохраняет `/market` и `dynamic = "force-dynamic"`; GET products API
  сохраняет parsing/status/headers/service, используя чистый model entry.
- SQL visibility, published/trusted-clean scan policy, attribution и доступ остаются
  в единственных существующих service/repository implementations.
- Search/category/sort/pagination, RU/EN, empty/end/error recovery, ссылки и карточки
  сохраняются без изменения UI и бесплатной модели каталога.
- Проверки: `pnpm test:catalog` с disposable PostgreSQL, tests карточки/preview и
  потребителей, architecture и полный CI, включая publishing/download browser.

Boundary suite — `scripts/tests/resources-feature-boundaries.node-test.mjs`.
Изменения feature требуют полного CI. Download authority, commerce и DRM не меняются.
