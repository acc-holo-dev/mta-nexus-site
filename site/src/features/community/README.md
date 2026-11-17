# Community: обсуждение и сообщения

Feature объединяет клиентское обсуждение публикации, форму жалобы, действия с
комментарием, обратную связь при отправке и создание темы. Сервисы, репозитории,
авторизация и транзакции доставки остаются единственными существующими реализациями.

| Entry                                 | Контракт                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `community-page-server.ts`            | Каталог обсуждений                                                            |
| `new-topic-page-server.ts`            | Создание темы                                                                 |
| `articles-page-server.ts`             | Каталог статей                                                                |
| `article-page-server.ts`              | Страница публикации и обсуждения                                              |
| `own-discussions-page-server.ts`      | Свои обсуждения                                                               |
| `own-discussion-page-server.ts`       | Деталь своего обсуждения                                                      |
| `author-desk-page-server.ts`          | Авторский кабинет публикаций                                                  |
| `author-create-page-server.ts`        | Создание авторской публикации                                                 |
| `author-edit-page-server.ts`          | Редактирование авторской публикации                                           |
| `author-history-page-server.ts`       | История авторской публикации                                                  |
| `following-feed-page-server.ts`       | Лента подписок                                                                |
| `reports-server.ts`                   | `CommunityReportScreen`; server-only жалобы заявителя и staff                 |
| `report-history-server.ts`            | `CommunityReportHistoryPage`, metadata; server-only история                   |
| `report-groups-server.ts`             | `CommunityReportGroupsPage`, metadata; server-only группировка                |
| `moderation-server.ts`                | `CommunityModerationScreen`; server-only модерация публикаций                 |
| `moderated-discussion-server.ts`      | `ModeratedDiscussionScreen`; server-only модерация обсуждений                 |
| `discussion-reports-server.ts`        | `DiscussionReportsScreen`; server-only жалобы на обсуждение                   |
| `publication-reports-server.ts`       | `PublicationReportsPage`, metadata; server-only жалобы на публикацию          |
| `catalog-controls.ts`                 | Фильтры и навигация каталога публикаций                                       |
| `reactions.ts`                        | `ContentReactions`; реакции на публикацию                                     |
| `reaction-removal.ts`                 | `ReactionRemoval`; снятие реакции в workspace с подтверждением                |
| `discussion-mutation-confirmation.ts` | `confirmsDiscussionMutation`                                                  |
| `content-moderation.ts`               | `ContentModerationControls`; действия модерации                               |
| `context-history-server.ts`           | `ContextPublicationHistoryScreen`; server-only история организаций и серверов |
| `article-view.ts`                     | `ArticleCard`; карточка публикации                                            |
| `publication-feed.ts`                 | `PublicationFeed`; лента публикаций                                           |
| `publication-feed-loading-server.ts`  | `PublicationFeedLoading`; server-only состояние загрузки                      |
| `author-content-form.ts`              | `AuthorContentForm`; редактор автора                                          |
| `author-publication-restore.ts`       | `AuthorPublicationRestore`; восстановление публикации                         |
| `own-discussion.ts`                   | `OwnDiscussionDetail`; клиентская деталь обсуждения                           |
| `discussion.ts`                       | `ContentDiscussion`; обсуждение публикации                                    |
| `topic-form.ts`                       | `CommunityTopicForm`; создание темы                                           |
| `report-form.ts`                      | `CommunityReportForm`; жалоба на публикацию или комментарий                   |
| `report-evidence-links.ts`            | `ReportEvidenceLinks`; безопасные внешние ссылки на доказательства в жалобе   |
| `object-mute-controls.ts`             | `ObjectMuteControls`; временный mute уведомлений по объекту подписки          |
| `follow.ts`                           | `FollowButton`, `FollowWorkspace`; подписка и лента сохранённых               |
| `follow-confirmation.ts`              | util port `follow-confirmation`                                               |
| `server-publication-history-contract.ts` | util port `server-publication-history-contract` |

Discussion, topic, report form и own discussion — client entries;
report и moderation screen entries используют `server-only`. Внутренние компоненты импортируются напрямую
внутри feature. Внешний production-код использует только входы. Клиентским компонентам запрещены прямые импорты routing, services, server,
инфраструктуры и Node builtins; negative
fixtures и транзитивные графы проверяют type/value зависимости.

Черновики и intent остаются привязаны к actor; подтверждения, revision,
восстановление после неизвестного результата, гостевой путь входа, доставка и
серверная авторизация сохраняют существующее поведение. Общие follow UI,
HTTP adapters, services и repositories не дублируются.

Экраны жалоб, история и группировка используют независимые server-only ports.
Session/role, private evidence, filters, pagination и server authority сохраняются.

Модерация публикаций и обсуждений, batch report actions и пользовательская
деталь обсуждения принадлежат Community. Staff/session authorization, revision,
confirmation и серверные транзакции сохраняются.

Карточка, лента, загрузка, подписка и авторские действия принадлежат Community. Подписка остаётся внутренним компонентом обсуждения; authority и существующие HTTP adapters сохранены.

Фильтры каталога, реакции, модерация и форма комментария входят в Community. Общая история публикаций имеет server-only вход и использует прежние сервисы организаций и серверов.

Каталоги, деталь публикации, создание темы, собственные обсуждения и авторский кабинет используют независимые server-only композиции. Динамический режим и metadata маршрутов сохраняются.

Создание, редактирование, история авторской публикации и лента подписок используют независимые server-only композиции с прежними проверками session и прав.
