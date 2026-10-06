# Source of Truth and Repository Handoff

Status: **OWNER-CONFIRMED / Round 10**

## 1. Repository location — completed

The owner-approved handbook is now an official part of:

```text
mta-nexus-site/docs/handbook/
```

The root `docs/` policy still keeps Architecture, Operations and Problems focused, while
`tests/mainline-repository-policy.test.ts` explicitly permits and checks the handbook.
README and Operations link the new source-of-truth model. This integration was performed
as one coherent mainline migration rather than leaving CI in an intentionally inconsistent state.

## 2. Product target precedence

When deciding **what NEXUS is supposed to become**, use this order:

1. owner-confirmed Decision Register / handbook;
2. security and data-integrity invariants;
3. current implementation, migrations, tests and canonical current technical docs;
4. legacy `MTA-MARKET-PLATFORM` material.

Legacy is evidence/history, not automatic product truth.

## 3. Runtime truth is still runtime truth

The hierarchy above does not authorize fiction. If handbook says paid marketplace is target but current runtime has checkout disabled, documentation and UI must say exactly that.

Use two questions separately:

- **CURRENT:** what exists safely in `main` now?
- **TARGET:** what has the owner approved for future implementation?

When they differ, create a migration/implementation plan. Never silently call a future feature current.

## 4. Security/data invariants

A general product wish must not silently weaken:

- malware fail-closed publication;
- authorization/ownership checks;
- payment idempotency/accounting integrity;
- auditability;
- privacy boundaries;
- immutable artifact identity/integrity;
- backup/recovery requirements.

If an owner decision truly requires changing an invariant, treat that as a dedicated high-risk architecture/security decision with explicit migration and review.

## 5. Recommended migration commit shape

A coherent integration should update together:

- `docs/handbook/**`;
- README documentation index;
- `tests/mainline-repository-policy.test.ts` or its successor;
- any docs-lint/link checks;
- references from `ARCHITECTURE.md` / `OPERATIONS.md` when useful;
- AI handoff/read-order guidance.

Avoid an intermediate commit where CI intentionally fails because policy still rejects the handbook.

## 6. Canonical technical docs

Keep existing current-state technical/operational documents canonical for executable-adjacent facts:

- `docs/ARCHITECTURE.md`;
- `docs/OPERATIONS.md`;
- `docs/PROBLEMS.md`.

The handbook should link to them rather than duplicate volatile current details wherever possible.

## 7. Agent behavior on conflict

If current code conflicts with an owner-confirmed target:

1. inspect current `main`;
2. identify why the runtime differs;
3. preserve security/data invariants;
4. design a backward-safe migration;
5. add/update tests around the intended contract;
6. update runtime and docs coherently;
7. verify exact SHA and required CI;
8. never claim target behavior exists before verification.

## 8. Handoff readiness

The handbook is considered suitable for AI handoff when:

- owner-confirmed decisions are separated from CURRENT/PROVISIONAL/OPEN/LEGACY;
- internal links and manifest pass;
- critical business/security contradictions are removed;
- remaining OPEN items are launch-specific rather than product-identity blockers;
- the agent can identify current-vs-target gaps without asking the owner to restate the whole project.