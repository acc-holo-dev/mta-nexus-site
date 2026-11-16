# Модерация

Жалобы на объекты, обработка жалоб, заявки на верификацию и staff dashboard `/admin`.

| Entry                                                                            | Контракт                                                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `object-report.ts`                                                               | Форма жалобы на объект                                                    |
| `report-controls.ts`                                                             | `ReportModerationControls`                                                |
| `verification-workspace.ts`, `verification-amend.ts`, `verification-controls.ts` | Верификация workspace                                                     |
| `reports-server.ts`                                                              | Серверные экраны жалоб                                                    |
| `admin-home.ts`                                                                  | `Admin*Section` blocks для `/admin` overview                              |
| `storage-maintenance.ts`                                                         | `StorageDiscoveryControls`, `StorageCleanupControls` для `/admin/storage` |

Внутренние `components/` не являются публичным API. Границы — dependency-cruiser и
`scripts/tests/moderation-feature-boundaries.node-test.mjs`.
