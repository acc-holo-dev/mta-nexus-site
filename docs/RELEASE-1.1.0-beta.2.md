# MTA NEXUS 1.1.0-beta.2 — maintenance consolidation

Date: 2026-09-25

## Decision

This prerelease is a maintenance follow-up to `1.1.0-beta.1`.

The beta.1 release consolidated the audited development branches into `main`.
After that consolidation, Dependabot created three new maintenance branches.
The repository owner asked to keep consolidating branches, resolve conflicts,
audit false positives and keep the repository version fixed.

Version: **1.1.0-beta.2**

All private workspace package manifests use the same prerelease version.

This is a repository integration decision. It is not evidence of a successful
production deployment, real provider delivery, or exact-SHA hosted-runner
acceptance.

## Included post-freeze maintenance

### GitHub Actions

`actions/upload-artifact` was updated from v4 to v7 in the three browser
evidence workflows.

The workflows continue to use GitHub-hosted runners. No self-hosted-runner
support claim is added by this change.

### Production/runtime dependencies

- `tsx`: 4.23.13 -> 4.23.15
- `drizzle-orm`: 0.45.2 -> 0.45.3

### Development dependencies

- `@types/node`: 26.6.1 -> 26.6.2
- `drizzle-kit`: 0.31.10 -> 0.31.11

The development update originally conflicted with the already-merged
production dependency update because both Dependabot branches modified the
same package manifests and `pnpm-lock.yaml`.

The conflict was reconciled against current `main` rather than by accepting
the stale bot lockfile wholesale. The final lockfile preserves all four
updates simultaneously.

## Branch and false-positive audit

Closed/unmerged historical feature branches still appear `diverged` from
`main` because many changes were rebased, copied, reconciled or rewritten
during the beta.1 consolidation.

A file-presence audit was repeated against current `main` for the remaining
release-evidence, route-privacy, server history/collector, server updates,
resource dependency, J4, J5, verification moderation and SERVER-008 branch
families.

Their unique routes, migrations, tests, scripts, components and documentation
are present in the consolidated tree.

The only historical branch-only path found absent was:

```text
scripts/write-release-evidence.mjs
```

That absence is intentional. The old script only recorded externally supplied
gate states. It is superseded by `scripts/release-evidence.mjs` and
`scripts/release-evidence-lib.mjs`, which execute the core release gates,
validate repository identity/dirty state, hash migrations/lockfile evidence
and fail closed when gates are blocked or fail.

Therefore the old path was classified as a **history false positive**, not a
missing release capability.

## Version consistency

A regression test now verifies that the root package and every private
workspace package use one identical version string.

The intended release tag is:

```text
v1.1.0-beta.2
```

The tag must point to the final `main` commit containing this release.

## Evidence limitation

GitHub-hosted Actions remain affected by the existing zero-step runner problem
tracked in issue #7. Recent jobs were created and failed without executing
runner steps.

Therefore:

- dependency/release code is integrated by explicit owner decision;
- existing test files are not misrepresented as executed evidence;
- exact-SHA CI acceptance remains open;
- production rollout remains a separate decision;
- the next real deployment must execute the accepted release gates on the
  exact release/tag candidate.
