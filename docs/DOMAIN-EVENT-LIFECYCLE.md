# Domain event lifecycle audit

This audit fixes two event-contract mismatches found after the 1.1.0-beta.2 branch consolidation.

## Build lifecycle

A newly uploaded clean build is persisted as `pending_review`.

It now emits:

```text
build.submitted_for_review
```

instead of `build.released`.

The `build.released` event is emitted only after `reviewBuild(... approve ...)` successfully returns a published build from the serialized moderation transaction.

A rejected build never emits `build.released`.

## Server ownership shape

Organization-owned servers intentionally may have no personal `ownerId`.

The `server.created` event payload therefore models:

- optional `ownerId`;
- optional `organizationId`.

This keeps the event contract aligned with the canonical server entity and AUTHZ-001 organization ownership rules.

## Evidence limitation

The GitHub-hosted runner issue is still tracked separately. These changes add regression/source-contract tests, but their exact candidate SHA is not declared accepted until executable CI evidence exists.
