# Commerce: workspace legacy shell

Open free-beta commerce history surfaces (purchases, licenses, sales) share layout,
tabs and pagination chrome. License workspace/admin detail, archive filters, control
panel and runtime probe live here too. Services, repositories, routes and
`commerce-history-*` / `license-*` helpers stay in existing layers.

| Entry                             | Контракт                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `workspace-history.ts`            | `HistoryShell`, `HistoryPagination`; `/workspace/{purchases,licenses,sales}` lists     |
| `license-controls.ts`             | `LicenseControlPanel`, `LicenseRuntimeProbe` (client)                                  |
| `license-detail.ts`               | `LicenseDetailView`; workspace/admin license detail                                    |
| `license-archive.ts`              | `LicenseArchiveFilters`; workspace license list filters                                |
| `license-history-server.ts`       | `LicenseHistoryPage`, `licenseHistoryMetadata`; workspace/admin license activity       |
| `subscription-controls.ts`        | `SubscriptionControls`, `SubscriptionFeeEstimator`, `SubscriptionRecovery` (client)    |
| `subscription-workspace.ts`       | `subscriptionNavLinkClass`; subscription workspace nav chrome (RSC-safe)               |
| `order-cancellation.ts`           | `OrderCancellationForm` (client); workspace purchase cancel                            |
| `order-case-forms.ts`             | `OrderCaseReviewForm` (client); create form composed via `order-case-server`           |
| `order-terms.ts`                  | `OrderTermsReportView`; buyer/admin order terms report (RSC-safe)                      |
| `order-case-server.ts`            | `OrderCaseListPage`, `OrderCaseDetailPage`, `OrderCaseCreatePage`, `orderCaseMetadata` |
| `commercial-plans.ts`             | `CommercialPlanForm`, `CommercialFeeCalculator` (client)                               |
| `plan-reviews.ts`                 | `PlanReviewForm` (client)                                                              |
| `plan-reviews-workspace.ts`       | `PlanReviewTerms`, `planReviewNavLinkClass` (RSC-safe)                                 |
| `plan-review-detail.ts`           | `PlanReviewDetailView`; workspace plan review detail                                   |
| `seller-sales.ts`                 | `SellerSalesReportView`; workspace seller sales report                                 |
| `license-runtime-response.ts`     | util port `license-runtime-response`                                                   |
| `order-case-response.ts`          | util port `order-case-response`                                                        |
| `plan-review-confirmation.ts`     | util port `plan-review-confirmation`                                                   |
| `license-control-confirmation.ts` | util port `license-control-confirmation`                                               |
| `subscription-confirmation.ts`    | util port `subscription-confirmation`                                                  |
| `license-archive-query.ts`        | util port `license-archive-query`                                                      |
| `order-case-query.ts`             | util port `order-case-query`                                                           |
| `license-runtime-query.ts`        | util port `license-runtime-query`                                                      |

Внутренние `components/` и `server/` не являются публичным API. Границы — dependency-cruiser
и `scripts/tests/commerce-feature-boundaries.node-test.mjs`.
