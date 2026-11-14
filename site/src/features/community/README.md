# Community: обсуждение и сообщения

Feature объединяет клиентское обсуждение публикации, форму жалобы, действия с
комментарием, обратную связь при отправке и создание темы. Сервисы, репозитории,
авторизация и транзакции доставки остаются единственными существующими реализациями.

| Entry                      | Контракт                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `reports-server.ts`        | `CommunityReportScreen`; server-only жалобы заявителя и staff  |
| `report-history-server.ts` | `CommunityReportHistoryPage`, metadata; server-only история    |
| `report-groups-server.ts`  | `CommunityReportGroupsPage`, metadata; server-only группировка |
| `discussion.ts`            | `ContentDiscussion`; обсуждение публикации                     |
| `topic-form.ts`            | `CommunityTopicForm`; создание темы                            |
| `report-form.ts`           | `CommunityReportForm`; жалоба на публикацию или комментарий    |
| `comment-actions.ts`       | `DiscussionCommentActions`; действия с комментарием            |

Discussion, topic, report form и comment actions — client entries; три report
screen entries используют `server-only`. Внутренние компоненты импортируются напрямую
внутри feature. Внешний production-код использует только входы. Клиентским компонентам запрещены прямые импорты routing, services, server,
инфраструктуры и Node builtins; negative
fixtures и транзитивные графы проверяют type/value зависимости.

Черновики и intent остаются привязаны к actor; подтверждения, revision,
восстановление после неизвестного результата, гостевой путь входа, доставка и
серверная авторизация сохраняют существующее поведение. Общие follow UI,
HTTP adapters, services и repositories не дублируются.

Экраны жалоб, история и группировка используют независимые server-only ports.
Session/role, private evidence, filters, pagination и server authority сохраняются.
