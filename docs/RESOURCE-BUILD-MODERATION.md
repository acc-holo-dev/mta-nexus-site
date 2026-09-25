# Resource build moderation controls

RESOURCE-011 closes the reviewer interaction gap around pending resource builds.

## Moderation decision API

The existing `POST /api/admin/actions` build action remains the single decision endpoint.

For build actions:

- moderator/admin capability is required;
- a review note of at least 3 characters is required;
- `ProductService.reviewBuild` remains the decision service;
- domain errors such as not-found, not-pending and non-clean approval preserve their 404/409/422 status and error code;
- the build repository's transactional moderation audit remains the authoritative build decision audit.

The generic admin-action audit is not written a second time for build decisions. This avoids duplicate audit entries and prevents a secondary audit failure from turning an already-committed build decision into a misleading HTTP 500.

## Reviewer artifact download

Authorized reviewers can request:

```text
GET /api/admin/builds/:buildId/download
```

The endpoint requires:

- moderator capability;
- `pending_review` build state;
- `scanStatus=clean`.

The artifact is always returned as `application/octet-stream` with attachment disposition, `nosniff`, private/no-store caching and the recorded SHA-256 header.

Non-clean artifacts are not offered for direct reviewer download. They can still be rejected through moderation.

The reviewer download itself is audited. If that audit fails after opening a local-storage stream, the stream is destroyed before returning an error.

## Admin UI

The Resource Build Queue now exposes:

- reviewer artifact download for clean pending builds;
- a required review note;
- Approve for clean builds only;
- Reject for any pending build once a note is present;
- explicit pending/error state.

## Scope boundary

This does not turn manual review into a malware guarantee. A clean scanner verdict is necessary for approval but remains distinct from cryptographic signing, source provenance and runtime safety.

This PR is stacked on RESOURCE-006, so deterministic published-build selection and `currentVersion` consistency are part of its base contract. RESOURCE-005 must still land before final acceptance so scanner infrastructure failures cannot create new dead-end pending builds.
