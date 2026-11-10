# Versioned server resource pack (GROW-08 proposal)

**Status:** local specification draft only. Not a pilot, install agent, or auto-update.
Depends on a chosen GROW-02 starter-collection pilot before claiming usefulness.
Schema/runtime changes are out of scope until OPS-06 authoring is accepted for this shape.

## Problem

Library collections today store product IDs. A server owner who wants a
reproducible set of resources still lacks an explicit snapshot of exact builds,
order, authorship, and verification outcome. Self-declared environments must not
be presented as automatic discovery.

## Snapshot shape (manual, small)

```json
{
  "schemaVersion": 1,
  "packId": "spk_…",
  "title": "Starter RP core",
  "authorAccountId": "usr_…",
  "createdAt": "2026-11-01T12:00:00.000Z",
  "environment": {
    "kind": "self_declared",
    "mtaClient": "1.6.0",
    "notes": "Dev VM; not auto-detected"
  },
  "entries": [
    {
      "order": 1,
      "productId": "prd_…",
      "buildId": "bld_…",
      "versionLabel": "1.2.0",
      "licenseModel": "unlimited",
      "accessAtSnapshot": "entitled",
      "verification": {
        "scanStatus": "trusted_clean",
        "scannerId": "…",
        "verifiedAt": "2026-10-30T00:00:00.000Z"
      }
    }
  ],
  "digest": "sha256:…"
}
```

## Rules

1. **Exact identity.** Each entry pins `productId` + `buildId` (+ human version label).
2. **Self-declared environment.** `environment.kind` is always `self_declared` in this draft; no probe invents host state.
3. **Pin changes are explicit.** Updating a build creates a new snapshot revision; old snapshots stay immutable.
4. **Access is per file.** Snapshot membership does not grant republish or redistribute rights.
5. **Verification is recorded, not invented.** Missing scan provenance → entry cannot claim trusted-clean.
6. **Manual usefulness first.** A two-resource sample must be readable by a human before any install-agent work.

## Non-goals

- Auto-update clients or MTA installers
- Rewriting existing library collections in place
- External invites, publications, or GROW pilot metrics
- Object-storage packaging of archives

## Sample acceptance probe (when GROW-02 exists)

Traceability: filler probe is gated on the chosen starter-collection pilot and its pre-pilot brief — see [GROW-02 starter-collection pilot](GROW-02-STARTER-COLLECTION-PILOT.md). No probe result is claimed here yet.

1. Build a snapshot of two entitled, trusted-clean builds.
2. Change one pin explicitly → new digest, previous snapshot unchanged.
3. Attempt to include a build the author cannot redistribute → rejected or marked `accessAtSnapshot: denied`.
4. Confirm self-declared environment text is shown as self-declared in any future UI.

## Relation to code

Today: `packages/domain/src/library-collections.ts` (product-level collections).
Future implementation would add a separate pack/snapshot type rather than overloading collection item rows.
