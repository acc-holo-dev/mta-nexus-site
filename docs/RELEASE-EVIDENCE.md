# Release evidence

DEVX-001 adds a machine-readable **core application** release-evidence bundle.

Run:

```bash
pnpm release:verify
```

The command runs the same core application gates that release review already depends on and writes:

```text
artifacts/release-evidence.json
```

The generated directory is ignored by Git.

## What the command proves

The command executes and records these gates:

1. repository/runtime identity;
2. release-evidence harness self-test;
3. database migrations;
4. TypeScript typecheck;
5. Vitest;
6. Next.js production build.

A gate record contains only:

- gate name;
- command name;
- status;
- exit code or signal;
- duration;
- a bounded non-secret reason when execution was blocked.

Command stdout/stderr is streamed to the terminal but is **not copied into the JSON bundle**.

## Fail-closed rules

The evidence is not a release candidate when:

- the working tree is dirty;
- Git identity cannot be read;
- pnpm/Git version cannot be read;
- GitHub Actions reports a `GITHUB_SHA` different from the checked-out commit;
- `DATABASE_URL` is absent, so migrations cannot be proved;
- any executed gate fails.

The command still writes the bundle after a failed or blocked gate and exits non-zero. This preserves useful evidence without converting a partial run into success.

## Recorded provenance

The bundle includes:

- checked-out Git SHA and branch/ref;
- dirty-working-tree state;
- safe GitHub run identifiers when present;
- Node, pnpm, Git, OS and architecture;
- project/package-manager metadata;
- SHA-256 of `pnpm-lock.yaml`;
- ordered database migration filenames and a SHA-256 for every SQL migration;
- gate outcomes;
- a SHA-256 over the evidence payload itself.

Environment variable values, database URLs, auth secrets, SMTP credentials and test command output are not written into the bundle.

## CI integration

The core CI Verify job uses `pnpm release:verify` instead of `pnpm check`.

This does **not** weaken the old gate:

- `pnpm typecheck` still runs;
- `pnpm test` still runs;
- `pnpm build` still runs.

It additionally repeats the migration command as an idempotency check and writes evidence.

The CI job intentionally does not upload the JSON through `actions/upload-artifact` yet. Artifact availability/quota has already been an operational problem, and current hosted Actions jobs are failing before runner steps execute. Once #7 is resolved, artifact retention can be added as a separate accepted change.

## Scope boundary

`release-evidence.json` is **not full release acceptance**.

It does not prove:

- Docker image startup;
- local Compose startup/persistence;
- account or directory browser journeys;
- visual acceptance;
- scanner behavior;
- external SMTP/inbox delivery;
- backup restore;
- production secrets;
- VDS/domain/TLS rollout;
- a public release decision.

Those require separate evidence. The bundle deliberately calls its scope `core_application`.
