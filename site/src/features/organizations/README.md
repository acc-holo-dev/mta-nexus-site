# Organizations: workspace и управление командой

Feature объединяет существующие экраны управления организацией, её командой,
профилем, историей и публикациями. Session, роли, серверные проверки прав,
сервисы и транзакции остаются прежними.

| Entry                                 | Контракт                                                               |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `workspace.ts`                        | `OrganizationWorkspacePanel`; клиентский workspace                     |
| `team.ts`                             | `OrganizationTeamDirectory`; клиентский каталог команды                |
| `profile.ts`                          | `OrganizationProfileForm`; клиентский профиль                          |
| `history-view.ts`                     | `OrganizationHistoryView`; представление истории                       |
| `public-directory-server.ts`          | Публичный каталог организаций                                          |
| `public-profile-server.ts`            | Публичный профиль организации и metadata                               |
| `public-activity-server.ts`           | Публичная активность организации                                       |
| `public-trust-server.ts`              | Публичная страница доверия организации                                 |
| `directory-page-server.ts`            | Серверная композиция списка организаций                                |
| `workspace-page-server.ts`            | Серверная композиция workspace организации                             |
| `team-page-server.ts`                 | Серверная композиция команды                                           |
| `activity-page-server.ts`             | Серверная композиция истории активности                                |
| `content-page-server.ts`              | Серверная композиция публикаций организации                            |
| `content-editor-server.ts`            | `OrganizationContentEditorPage`; server-only редактор публикации       |
| `publication-history-server.ts`       | `OrganizationPublicationHistoryScreen`; server-only история публикации |
| `organization-member-confirmation.ts` | util port `organization-member-confirmation`                           |
| `organization-workspace-client.ts` | util port `organization-workspace-client` |
| `organization-team-copy.ts` | util port `organization-team-copy` |

Редактор участника, пакетные действия и передача владения — внутренние клиентские
компоненты. Публичные входы используются внешним production-кодом; прямые и
транзитивные клиентские зависимости проверяются на отсутствие routing, серверных
модулей, инфраструктуры и Node builtins. История публикации использует общий
server-only вход Community. Actor, revision, confirmation, recovery и серверная
проверка прав сохраняют существующее поведение.

Маршруты workspace сохраняют dynamic rendering и metadata; независимые server-only композиции сохраняют фильтры, session и права.

Публичные каталог, профиль, активность и доверие имеют независимые server-only входы. Metadata и профиль разделяют request-scoped чтение.
