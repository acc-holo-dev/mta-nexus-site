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
| `admin-status-labels.ts`                                                         | `adminStatusLabel`, `adminStatusTone` (staff enum labels)                 |
| `verification-moderation.ts`                                                     | `buildVerificationDecisionPayload`, notes normalize                       |
| `storage-maintenance-i18n.ts`                                                    | util port `storage-maintenance-i18n`                                      |
| `verification-applications-copy.ts`                                              | util port `verification-applications-copy`                                |
| `storage-maintenance-query.ts`                                                   | util port `storage-maintenance-query`                                     |
| `admin-action-confirmation.ts`                                                   | util port `admin-action-confirmation`                                     |
| `platform-report-i18n.ts`                                                        | util port `platform-report-i18n`                                          |
| `report-batch-contract.ts`                                                       | util port `report-batch-contract`                                         |

Внутренние `components/` не являются публичным API. Границы — dependency-cruiser и
`scripts/tests/moderation-feature-boundaries.node-test.mjs`.
