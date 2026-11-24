# Navigation state backlog (CEO program W1)

**Owner:** coordinator agent · **Contract:** UX-CONTRACT § catalogs — URL is source of filters/sort/pagination.

Status: `open` | `pr` | `done`. PR refs link GitHub.

| Status | Sev | Route / surface              | Issue                          | Primary files                                  | Test extension                                |
| ------ | --- | ---------------------------- | ------------------------------ | ---------------------------------------------- | --------------------------------------------- |
| done   | P0  | `/servers` live MTA          | Client-only filters            | `mta-master-server-directory.tsx`              | `mta-directory-page-query.test.ts` · PR #1200 |
| done   | P0  | `/support`, `/admin/support` | Case back drops queue filters  | `support-*`, `support-page.tsx`                | `support-workspace-*` · PR #1201              |
| open   | P0  | `/workspace/order-cases`     | Detail back ignores list query | `order-case-page.tsx`                          | `order-case-pages.test.tsx`                   |
| open   | P0  | Order case list links        | Detail href bare id            | `order-case-page.tsx`                          | same                                          |
| open   | P0  | `/workspace/content` desk    | Editor back drops filters      | `author-desk-page.tsx`, `author-edit-page.tsx` | `user-platform-surface.test.tsx`              |
| open   | P0  | Server/org publications      | Same                           | `publications-screen.tsx`, `*-editor-page.tsx` | content tests                                 |
| open   | P1  | Resource review reports      | Tab `view` lost on detail      | `resource-review-report-screen.tsx`            | `resource-review-contract.test.ts`            |
| open   | P1  | Support messages             | Back to case loses queue       | `support-message-browser.tsx`                  | new surface test                              |
| open   | P1  | Article discussion           | Client search not in URL       | `content-discussion.tsx`                       | `discussion-discovery.test.ts`                |
| open   | P1  | Saved follows                | Cursor pagination client-only  | `follow-workspace.tsx`                         | `saved-follows-page.test.tsx`                 |
| open   | P2  | Resource Q&A panel           | Thread selection client-only   | `resource-qa-panel.tsx`                        | TBD                                           |
| open   | P2  | Server reviews panel         | Page client-only               | `server-review-panel.tsx`                      | TBD                                           |
| open   | P2  | Trust context history        | back `base` only               | `public-context-trust-page.tsx`                | TBD                                           |

## Policy (target)

1. List surfaces expose `*Href(filters)` and use it on pagination, export, and detail links.
2. Detail surfaces accept list `searchParams` or `returnPage` and thread into every in-app **Back**.
3. Client islands sync URL via `router.replace` or GET forms — no orphan `useState` for shareable filters.

## Reference implementations

- `discover-query.ts` + `discovery-directory.tsx`
- `market` catalog query tests
- `supportHref` / `supportCaseHref` (post #1201)
- `contentPageHref` (workspace content)
