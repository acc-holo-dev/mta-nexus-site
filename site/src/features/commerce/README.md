# Commerce: workspace legacy shell

Open free-beta commerce history surfaces (purchases, licenses, sales) share layout,
tabs and pagination chrome. License workspace/admin detail, archive filters, control
panel and runtime probe live here too. Services, repositories, routes and
`commerce-history-*` / `license-*` helpers stay in existing layers.

| Entry                       | Контракт                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `workspace-history.ts`      | `HistoryShell`, `HistoryPagination`; `/workspace/{purchases,licenses,sales}` lists |
| `license-controls.ts`       | `LicenseControlPanel`, `LicenseRuntimeProbe` (client)                              |
| `license-detail.ts`         | `LicenseDetailView`; workspace/admin license detail                                |
| `license-archive.ts`        | `LicenseArchiveFilters`; workspace license list filters                            |
| `license-history-server.ts` | `LicenseHistoryPage`, `licenseHistoryMetadata`; workspace/admin license activity   |

Внутренние `components/` и `server/` не являются публичным API. Границы — dependency-cruiser
и `scripts/tests/commerce-feature-boundaries.node-test.mjs`.
