# Commerce: workspace legacy shell

Open free-beta commerce history surfaces (purchases, licenses, sales) share layout,
tabs and pagination chrome. License workspace/admin detail, archive filters, control
panel and runtime probe live here too. Services, repositories, routes and
`commerce-history-*` / `license-*` helpers stay in existing layers.

**Wallet (NX-015):** domain ports live in `@nexus/domain` (`wallet-payments`) and
`site/src/lib/services/commerce/wallet-payment-service.ts`. Site stored-value balance
uses the existing double-entry ledger; multi-provider capability matrix (admin
`/admin/commerce/wallet-providers`); stub top-up plus dark Stripe/YooKassa/crypto
ports that refuse sessions until PSP contracts. Top-up intents persist in `wallet_topup_intents` (migration
`0091_wallet_topup_intents`) via `walletTopupRepository`. Stub credit:
`POST /api/wallet/topups/:id/stub-credit` applies a stub-only verified outcome.
Ledger wallet reference
kinds (`topup` / `wallet_spend` / …) require migration `0092_ledger_wallet_reference_types`.
Pending paid orders settle via `POST /api/orders/:id/pay-with-wallet` (atomic
`wallet_spend` with ECON-001 platform fee + ECON-002 escrow holds, completed
payment, order completion, download entitlement). Create+settle from catalog:
`POST /api/checkout/wallet` (card `/api/checkout` stays `CHECKOUT_DISABLED`).
Ledger activity: `GET /api/wallet/activity`. Seller holds: `GET /api/wallet/held`,
`POST /api/wallet/holds/release-matured` (migration `0093_wallet_seller_holds`,
7-day baseline). Personal and organization seller accounts (`user:` / `org:`) —
org inspect/release requires owner/admin membership. Admin batch release:
`POST /api/admin/commerce/wallet-holds/release-matured` (across sellers).
Workspace wallet shows a release CTA for matured personal/org holds.
Organization owner/admin can inspect available balance and stub-top-up
`org:` accounts via optional `organizationId` on balance/activity/topups.
HTTP routes under `/api/wallet/*`, pay-with-wallet, checkout/wallet, and
`/workspace/wallet` stay dark unless `NEXUS_WALLET_ENGINE=1`. Withdrawal
intents (migration `0094_wallet_withdrawal_intents`) hold available balance in
escrow until a verified payout event; HTTP `POST /api/wallet/withdrawals` also
needs `NEXUS_WALLET_WITHDRAW=1` (live payout adapters stay off).
`GET`/`POST /api/wallet/withdrawals` accept optional `organizationId`
(owner/admin); `POST /api/wallet/withdrawals/:id/cancel` returns escrow to
available for awaiting intents; `POST /api/wallet/withdrawals/:id/stub-settle`
applies a stub-only verified payout outcome. `/workspace/wallet` shows personal
and org stub withdraw forms, recent intents, cancel and stub-settle CTAs when
withdraw policy is on. When the engine is on, authors may create/release paid
`single_server` listings (still not card checkout). Redirect never credits the
wallet.

| Entry                                | Контракт                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `workspace-history.ts`               | `HistoryShell`, `HistoryPagination`; `/workspace/{purchases,licenses,sales}` lists                                |
| `license-controls.ts`                | `LicenseControlPanel`, `LicenseRuntimeProbe` (client)                                                             |
| `license-detail.ts`                  | `LicenseDetailView`; workspace/admin license detail                                                               |
| `license-archive.ts`                 | `LicenseArchiveFilters`; workspace license list filters                                                           |
| `license-history-server.ts`          | `LicenseHistoryPage`, `licenseHistoryMetadata`; workspace/admin license activity                                  |
| `subscription-controls.ts`           | `SubscriptionControls`, `SubscriptionFeeEstimator`, `SubscriptionRecovery` (client)                               |
| `subscription-workspace.ts`          | `subscriptionNavLinkClass`; subscription workspace nav chrome (RSC-safe)                                          |
| `order-cancellation.ts`              | `OrderCancellationForm` (client); workspace purchase cancel                                                       |
| `order-case-forms.ts`                | `OrderCaseReviewForm` (client); create form composed via `order-case-server`                                      |
| `order-terms.ts`                     | `OrderTermsReportView`; buyer/admin order terms report (RSC-safe)                                                 |
| `order-case-server.ts`               | `OrderCaseListPage`, `OrderCaseDetailPage`, `OrderCaseCreatePage`, `orderCaseMetadata`                            |
| `commercial-plans.ts`                | `CommercialPlanForm`, `CommercialFeeCalculator` (client)                                                          |
| `plan-reviews.ts`                    | `PlanReviewForm` (client)                                                                                         |
| `plan-reviews-workspace.ts`          | `PlanReviewTerms`, `planReviewNavLinkClass` (RSC-safe)                                                            |
| `plan-review-detail.ts`              | `PlanReviewDetailView`; workspace plan review detail                                                              |
| `seller-sales-report-server.ts`      | `SellerSalesReportScreen`, metadata; workspace seller sales report                                                |
| `license-runtime-response.ts`        | util port `license-runtime-response`                                                                              |
| `order-case-response.ts`             | util port `order-case-response`                                                                                   |
| `plan-review-confirmation.ts`        | util port `plan-review-confirmation`                                                                              |
| `license-control-confirmation.ts`    | util port `license-control-confirmation`                                                                          |
| `subscription-confirmation.ts`       | util port `subscription-confirmation`                                                                             |
| `license-archive-query.ts`           | util port `license-archive-query`                                                                                 |
| `order-case-query.ts`                | util port `order-case-query`                                                                                      |
| `license-runtime-query.ts`           | util port `license-runtime-query`                                                                                 |
| `commercial-confirmation.ts`         | util port `commercial-confirmation`                                                                               |
| `order-terms-i18n.ts`                | util port `order-terms-i18n`                                                                                      |
| `seller-sales-i18n.ts`               | util port `seller-sales-i18n`                                                                                     |
| `plan-reviews-i18n.ts`               | util port `plan-reviews-i18n`                                                                                     |
| `subscriptions-i18n.ts`              | util port `subscriptions-i18n`                                                                                    |
| `license-control-i18n.ts`            | util port `license-control-i18n`                                                                                  |
| `financial-i18n.ts`                  | util port `financial-i18n`                                                                                        |
| `license-archive-csv.ts`             | util port `license-archive-csv`                                                                                   |
| `subscription-time.ts`               | util port `subscription-time`                                                                                     |
| `seller-sales-csv.ts`                | util port `seller-sales-csv`                                                                                      |
| `commercial-plan-query.ts`           | util port `commercial-plan-query`                                                                                 |
| `financial-query.ts`                 | util port `financial-query`                                                                                       |
| `commercial-i18n.ts`                 | util port `commercial-i18n`                                                                                       |
| `commerce-history-i18n.ts`           | util port `commerce-history-i18n`                                                                                 |
| `license-maintenance-i18n.ts`        | util port `license-maintenance-i18n`                                                                              |
| `commerce-history-format.ts`         | util port `commerce-history-format`                                                                               |
| `license-model-i18n.ts`              | util port `license-model-i18n`                                                                                    |
| `order-case-i18n.ts`                 | util port `order-case-i18n`                                                                                       |
| `order-terms-query.ts`               | util port `order-terms-query`                                                                                     |
| `plan-reviews-query.ts`              | util port `plan-reviews-query`                                                                                    |
| `seller-sales-query.ts`              | util port `seller-sales-query`                                                                                    |
| `subscriptions-query.ts`             | util port `subscriptions-query`                                                                                   |
| `checkout-api-copy.ts`               | util port `checkout-api-copy`                                                                                     |
| `commercial-public-http.ts`          | util port `commercial-public-http`                                                                                |
| `license-runtime-http.ts`            | util port `license-runtime-http`                                                                                  |
| `wallet-http.ts`                     | util port `wallet-http`; `/api/wallet/{balance,activity,held,holds/release-matured,topups,providers/.../webhook}` |
| `wallet-i18n.ts`                     | util port `wallet-i18n`                                                                                           |
| `wallet-topup.ts`                    | `WalletTopUpForm` (client); stub top-up against `/api/wallet/topups`                                              |
| `wallet-topup-confirmation.ts`       | util port `wallet-topup-confirmation`                                                                             |
| `wallet-pay.ts`                      | `WalletPayOrderForm` (client); pay pending order via `/api/orders/:id/pay-with-wallet`                            |
| `wallet-pay-confirmation.ts`         | util port `wallet-pay-confirmation`                                                                               |
| `wallet-checkout.ts`                 | `WalletCheckoutButton` (client); create+settle via `/api/checkout/wallet`                                         |
| `wallet-checkout-confirmation.ts`    | util port `wallet-checkout-confirmation`                                                                          |
| `wallet-workspace-server.ts`         | `WalletWorkspaceScreen`, metadata; `/workspace/wallet`                                                            |
| `acquire-page.ts`                    | `AcquirePage` (client); free claim + wallet checkout when engine on                                               |
| `acquire-page-server.ts`             | `AcquirePageScreen`; RSC shell for `/acquire` session + wallet flag                                               |
| `wallet-providers-admin-server.ts`   | `WalletProvidersAdminScreen`, metadata; `/admin/commerce/wallet-providers`                                        |
| `wallet-admin-ops.ts`                | `WalletAdminBatchForm` (client); admin hold-release / stale top-up / withdrawal expiry batches                    |
| `wallet-admin-batch-confirmation.ts` | util port `wallet-admin-batch-confirmation`                                                                       |

Внутренние `components/` и `server/` не являются публичным API. Границы — dependency-cruiser
и `scripts/tests/commerce-feature-boundaries.node-test.mjs`.
