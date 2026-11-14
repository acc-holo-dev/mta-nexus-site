# Community: обсуждение и сообщения

Feature объединяет клиентское обсуждение публикации, форму жалобы, действия с
комментарием, обратную связь при отправке и создание темы. Сервисы, репозитории,
авторизация и транзакции доставки остаются единственными существующими реализациями.

| Entry                            | Контракт                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| `reports-server.ts`              | `CommunityReportScreen`; server-only жалобы заявителя и staff        |
| `report-history-server.ts`       | `CommunityReportHistoryPage`, metadata; server-only история          |
| `report-groups-server.ts`        | `CommunityReportGroupsPage`, metadata; server-only группировка       |
| `moderation-server.ts`           | `CommunityModerationScreen`; server-only модерация публикаций        |
| `moderated-discussion-server.ts` | `ModeratedDiscussionScreen`; server-only модерация обсуждений        |
| `discussion-reports-server.ts`   | `DiscussionReportsScreen`; server-only жалобы на обсуждение          |
| `publication-reports-server.ts`  | `PublicationReportsPage`, metadata; server-only жалобы на публикацию |
| `own-discussion.ts`              | `OwnDiscussionDetail`; клиентская деталь обсуждения                  |
| `discussion.ts`                  | `ContentDiscussion`; обсуждение публикации                           |
| `topic-form.ts`                  | `CommunityTopicForm`; создание темы                                  |
| `report-form.ts`                 | `CommunityReportForm`; жалоба на публикацию или комментарий          |

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
