# Release evidence

`scripts/write-release-evidence.mjs` creates a machine-readable snapshot of release evidence without making a release decision.

It deliberately separates three concepts:

1. a gate result was recorded;
2. all required recorded gates passed;
3. a human/product release decision was made.

The script can establish the first two from explicit inputs. It always writes `releaseDecision: "not-recorded"`; promotion to `main`, tagging and production deployment remain separate actions.

## Outputs

By default:

- `artifacts/release-evidence/release-evidence.json`
- `artifacts/release-evidence/release-evidence.md`

Override the destination with `NEXUS_EVIDENCE_OUTPUT_DIR`.

The evidence contains the commit/ref, selected toolchain versions, SHA-256 of `pnpm-lock.yaml`, the SQL migration inventory, supplied gate outcomes and an optional production image digest. It never serializes the environment wholesale.

## Gate inputs

Accepted values are `success`, `failure`, `cancelled`, `skipped` and `not-recorded`.

- `NEXUS_EVIDENCE_VERIFY`
- `NEXUS_EVIDENCE_ACCOUNT_BROWSER`
- `NEXUS_EVIDENCE_DIRECTORY_BROWSER`
- `NEXUS_EVIDENCE_POSTGRES_PERSISTENCE`
- `NEXUS_EVIDENCE_LOCAL_DOCKER`
- `NEXUS_EVIDENCE_PRODUCTION_DOCKER`

Optional identity inputs:

- `NEXUS_EVIDENCE_COMMIT`
- `NEXUS_EVIDENCE_REF`
- `NEXUS_EVIDENCE_PRODUCTION_IMAGE_DIGEST`

When commit/ref are omitted, GitHub Actions metadata is preferred and local Git metadata is used only as a fallback.

## Local verification

Run:

```bash
pnpm release:evidence:test
pnpm release:evidence
```

A locally generated file is metadata, not CI evidence. Do not mark a gate `success` unless the corresponding check actually ran for the same commit and environment.

## CI integration boundary

The initial REL-001 foundation does not add another GitHub Actions job. The repository currently has a runner/quota failure mode where jobs are created with zero steps, so adding runner load would not improve evidence. Once runners execute normally, existing jobs can pass their actual outcomes into this script and publish the JSON/Markdown alongside the existing release-readiness record.
