# Commerce: workspace legacy shell

Open free-beta commerce history surfaces (purchases, licenses, sales) share layout,
tabs and pagination chrome. Services, repositories, routes and `commerce-history-*`
helpers stay in existing layers.

| Entry                  | Контракт                                                                     |
| ---------------------- | ---------------------------------------------------------------------------- |
| `workspace-history.ts` | `HistoryShell`, `HistoryPagination`; `/workspace/{purchases,licenses,sales}` |

Внутренние `components/` не являются публичным API. Границы — dependency-cruiser и
`scripts/tests/commerce-feature-boundaries.node-test.mjs`.
