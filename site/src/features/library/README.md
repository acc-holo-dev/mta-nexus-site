# Library: коллекции и команды

Feature объединяет существующие представления коллекций и клиентские формы
команд, пакетных действий и переноса элементов. Session, actor/revision,
серверная авторизация, сервисы и repository locks сохраняются.

| Entry                                       | Контракт                                                      |
| ------------------------------------------- | ------------------------------------------------------------- |
| `membership-history-server.ts`              | Серверный экран истории членства                              |
| `selection-batch-server.ts`                 | Серверный экран пакетного выбора версий                       |
| `collection-import.ts`                      | Клиентский импорт и сверка коллекции                          |
| `collection-restore.ts`                     | Клиентское восстановление коллекции                           |
| `membership-batch.ts`                       | Клиентское пакетное управление членством                      |
| `release-comparison-server.ts`              | Серверное сравнение версий ресурса                            |
| `release-history-server.ts`                 | Серверная история выбора версий                               |
| `collection-releases-server.ts`             | Серверный экран версий коллекции                              |
| `collection-requirements-server.ts`         | Серверный экран требований коллекции                          |
| `release-follow.ts`                         | Клиентский переход на актуальную версию                       |
| `release-selection.ts`                      | Клиентский выбор версии                                       |
| `library-release-request.ts`                | `freezeLibraryReleaseRequest`, `matchesLibraryReleaseRequest` |
| `library-membership-batch-confirmation.ts`  | `confirmedMembershipBatch`                                    |
| `library-selection-batches-confirmation.ts` | Selection batch confirm helpers                               |
| `library-membership-batches-i18n.ts`        | `libraryMembershipBatchesCopy`                                |
| `library-selection-batches-i18n.ts`         | `librarySelectionBatchesCopy`                                 |
| `collection-import-page-server.ts`          | Серверная страница импорта                                    |
| `collection-reconcile-page-server.ts`       | Серверная страница сверки                                     |
| `collection-compare-page-server.ts`         | Серверное сравнение коллекций                                 |
| `collection-receipt-page-server.ts`         | Серверная квитанция команды                                   |
| `collection-history-page-server.ts`         | Серверная история команд                                      |
| `collection-inventory-page-server.ts`       | Серверный инвентарь коллекций                                 |
| `resource-collections-page-server.ts`       | Серверные коллекции ресурса                                   |
| `library-page-server.ts`                    | `LibraryPageScreen`; server-only главная библиотека           |
| `library-updates-server.ts`                 | `LibraryUpdatesScreen`; server-only обновления                |
| `library-downloads-server.ts`               | `LibraryDownloadsScreen`; server-only выдачи                  |
| `library-watches-server.ts`                 | `LibraryWatchesScreen`; server-only watch-лист                |
| `library-watch-history-server.ts`           | `LibraryWatchHistoryScreen`; server-only история watch        |
| `library-reviews-server.ts`                 | `LibraryReviewsScreen`; server-only свои отзывы               |
| `collections-server.ts`                     | `LibraryCollectionsScreen`; server-only экран коллекций       |
| `collection-command.ts`                     | Клиентская форма команды коллекции                            |
| `collection-batch.ts`                       | Клиентская форма пакетной команды                             |
| `collection-item-copy.ts`                   | Клиентская форма копирования и переноса элементов             |
| `collection-requirements-i18n.ts`           | util port `collection-requirements-i18n`                      |
| `library-collection-receipts-i18n.ts`       | util port `library-collection-receipts-i18n`                  |
| `library-collections-confirmation.ts`       | util port `library-collections-confirmation`                  |
| `library-collection-manifests-i18n.ts`      | util port `library-collection-manifests-i18n`                 |
| `library-collection-comparison-query.ts`    | util port `library-collection-comparison-query`               |
| `library-release-history-i18n.ts`           | util port `library-release-history-i18n`                      |
| `collection-releases-query.ts`              | util port `collection-releases-query`                         |
| `library-release-comparison-query.ts`       | util port `library-release-comparison-query`                  |
| `library-collection-history-query.ts`       | util port `library-collection-history-query`                  |
| `collection-releases-i18n.ts`               | util port `collection-releases-i18n`                          |
| `library-collection-comparison-i18n.ts`     | util port `library-collection-comparison-i18n`                |
| `library-collection-inventory-i18n.ts`      | util port `library-collection-inventory-i18n`                 |
| `library-release-comparison-i18n.ts`        | util port `library-release-comparison-i18n`                   |
| `library-collection-inventory-query.ts`     | util port `library-collection-inventory-query`                |
| `library-membership-history-query.ts`       | util port `library-membership-history-query`                  |
| `library-collection-history-i18n.ts`        | util port `library-collection-history-i18n`                   |
| `library-membership-history-i18n.ts`        | util port `library-membership-history-i18n`                   |
| `library-collections-i18n.ts`               | util port `library-collections-i18n`                          |
| `resource-release-control-i18n.ts`          | util port `resource-release-control-i18n`                     |
| `resource-release-control-confirmation.ts`  | util port `resource-release-control-confirmation`             |
| `library-collections-query.ts`              | util port `library-collections-query`                         |
| `library-release-history-query.ts`          | util port `library-release-history-query`                     |
| `user-library.ts`                           | util port `user-library`                                      |
| `library-view.ts`                           | util port `library-view`                                      |

Список, детали, история, копирование и внутренние представления принадлежат
feature. Внешний production-код использует публичные входы; feature не импортирует
routing. Клиентские графы проверяются на отсутствие серверных модулей,
инфраструктуры и Node builtins. Confirmation, recovery, доступность ресурсов и
существующие транзакции остаются прежними.

Импорт, сверка и восстановление, пакетное членство и выбор версий входят в Library. Серверные экраны используют прежние сервисы и проверки session.

Выбор и сравнение версий, история, релизы и требования коллекции используют независимые client и server-only входы. Существующие подтверждения и проверки доступа сохраняются.

Композиции импорта, сверки, сравнения, истории, квитанций и инвентаря имеют отдельные server-only входы. Динамические маршруты и metadata остаются в App Router.
