# Servers: публичный каталог

Пилот feature architecture объединяет read-only каталог MTA, карточки наблюдений
и managed listings, их чистые проекции и server composition страницы `/servers`.
Raw master observation и managed profile остаются разными источниками правды.
Claim, ownership, management, reviews, history и collectors пока находятся в
прежних модулях. Services не дублируются и не переносятся этим шагом.

## Публичные entrypoints

| Entry                  | Контракт                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `connect.ts`           | `ServerConnectControls`; client connect/copy UI                                                   |
| `statistics-export.ts` | `ServerStatisticsExportButton`; client экспорт                                                    |
| `statistics-view.ts`   | `ServerObservationPeriodControls`; RSC-compatible выбор периода                                   |
| `client.ts`            | `MtaMasterServerDirectory`, `ServerCard`, `HomeNetworkServerCard`; клиентский UI                  |
| `server.ts`            | `ServersPage`; Next server-only composition, locale и существующий `serverService`                |
| `model.ts`             | Тип наблюдения, live status, endpoint/profile projection, pagination и HTTP freshness; чистый код |

App routes, общие components/lib и другие features используют эти entrypoints.
Прямой импорт `components/`, `model/` или `server/` извне feature запрещён
dependency-cruiser. Внутренние модули обращаются друг к другу напрямую.
Behavior tests могут тестировать приватный компонент отдельно.

Страница App Router делегирует server entrypoint; GET directory API сохраняет
parse/status/headers/logging и вызывает прежний master service. API получает
pagination/cache helpers через чистый `model`, поэтому не импортирует RSC или БД
через server barrel. Master service также использует только чистый model contract.
Model не импортирует service, UI, routing, Node builtins или infrastructure packages.
Client components не импортируют server entrypoint, services или request locale.
Общий locale/dictionary остаётся в `lib/i18n`, primitives — в `@nexus/ui`.

## Сохраняемое поведение

- Публичные URLs, query validation, pagination и response headers остаются прежними.
- Stale/unknown/zero различаются; editorial counts не подменяют свежие observations.
- Connect/Copy выражают intent; ошибка clipboard сохраняет ручной fallback.
- RU/EN, empty/error/stale, keyboard и mobile поведение сохраняются.
- Существующая service cache остаётся единственной; новых network collectors нет.

Проверки: `pnpm test:directory` с отдельной disposable БД, focused UI/API/model
tests, `pnpm analyze:architecture` и negative fixtures в
`scripts/tests/servers-feature-boundaries.node-test.mjs`. Этот suite проверяет и
transitive closure реальных client/model entrypoints. Все изменения Servers pilot
требуют полного CI, включая directory browser.

Connect/copy, экспорт статистики и выбор периода принадлежат Servers.
Clipboard fallback, ограничения периода, timeout/abort и серверные проверки доступа
сохраняются; UI не доказывает факт игры и не меняет наблюдения.
