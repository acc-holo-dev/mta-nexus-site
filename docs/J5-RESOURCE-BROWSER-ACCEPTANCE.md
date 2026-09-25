# J5 browser acceptance: free resource claim and download

RESOURCE-013 adds a production-like browser journey for the closed-beta free-resource path.

It is an acceptance candidate, not a runtime feature.

## Journey

The disposable test proves this sequence through the real application:

1. start the production Docker/Compose/TLS rehearsal;
2. seed one published free resource and one clean published build in the disposable database;
3. place the exact build bytes in the disposable local-storage volume;
4. register an ordinary player through the real public authentication API in the browser context;
5. open the public resource page;
6. verify that no download action is available before entitlement;
7. follow the real **Add to library** link to checkout;
8. click the real checkout **Add to library** button;
9. require the claim route to return HTTP 201;
10. return to the resource and observe **In your library** plus the download action;
11. open Workspace and observe the resource in **Resource library**;
12. click the real **Download Build v1.0.0** link;
13. hash the downloaded file and require it to equal the seeded SHA-256;
14. query the disposable database and require exactly one download entitlement and `sales_count=1`.

## Fixture boundary

The resource author, published product and published build are seeded directly because author upload/moderation is a separate J4 journey.

The browser fixture deliberately does **not** insert:

- the player account;
- the player session;
- a license;
- an entitlement;
- a fake checkout/order/payment.

The player account is registered through the live auth flow, and the entitlement must be created by the real `/api/resources/claim` path after the visible checkout action.

No test-only HTTP endpoint is added.

## Environment

The script sources the existing production startup rehearsal. The journey therefore uses:

- the production runtime image;
- PostgreSQL migrations;
- Caddy HTTPS with the disposable trusted CA;
- the real Next.js application;
- the real session cookie;
- the real entitlement repository;
- the real local storage provider;
- the real download Route Handler.

The Playwright package remains a CI-only browser tool installed outside the application dependency graph.

## Evidence

On success the workflow requires:

- `resource-results.json`;
- `resource-summary.md`;
- `playwright-report.json`.

Screenshots/traces remain optional artifacts. A failure to upload optional artifacts does not convert failed browser assertions into success.

## Limitations

This journey intentionally does not prove:

- resource author onboarding;
- archive upload;
- ClamAV verdicts;
- moderator build approval;
- paid checkout;
- S3/object storage;
- visual design approval across browsers;
- public production rollout.

Those remain separate acceptance gates.

RESOURCE-013 should be evaluated only after the Playwright foundation (#3), J5 download policy (#30), claim hardening (#31/#29), production proxy boundary (#38), and runner blocker #7 are reconciled on the exact candidate SHA.
