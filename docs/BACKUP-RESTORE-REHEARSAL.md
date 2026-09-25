# Disposable backup and restore rehearsal

OPS-001 adds a destructive **disposable CI-only** rehearsal for the two persistent data classes required by the closed beta:

- PostgreSQL data;
- private upload files.

It is a candidate release gate, not evidence of a real environment restore until a GitHub-hosted run completes successfully on the exact release candidate.

## Safety boundary

The script refuses to run unless all of these are true:

- `GITHUB_ACTIONS=true`;
- `RUNNER_ENVIRONMENT=github-hosted`;
- `DOCKER_HOST` is unset;
- `DOCKER_CONTEXT` is unset;
- the active Docker context is `default`.

It does not accept a project name, database URL, volume name or credentials from the operator.

It renders `compose.production.yaml` only to inspect the approved storage topology. Repository `.env` loading is disabled and synthetic values are provided for required Compose interpolation.

All destructive state uses:

- UUID-derived project names;
- UUID-derived volume names;
- an ownership label `io.nexus.backup-restore-test`;
- exact ownership checks before every volume removal.

The script never uses volume prune and never runs `docker compose down --volumes` against a production project.

## Rehearsal sequence

The source phase:

1. validates the production PostgreSQL image and named-volume topology;
2. creates new disposable PostgreSQL and uploads volumes;
3. starts PostgreSQL 18 with synthetic credentials;
4. writes two database probe rows;
5. writes two private-upload probe files;
6. creates a custom-format `pg_dump`;
7. creates a compressed uploads archive;
8. records SHA-256 for both backup files;
9. destroys the source containers and source volumes.

Only after the source volumes are confirmed removed does the restore phase begin.

The restore phase:

1. creates different empty disposable volumes;
2. starts a fresh PostgreSQL cluster;
3. restores the database using `pg_restore`;
4. extracts the uploads archive into the fresh uploads volume;
5. verifies the exact database rows;
6. verifies both upload file contents;
7. removes all restore containers and owned volumes.

The temporary backup files are removed when the rehearsal completes.

## CI job

The main CI workflow adds a separate job:

```text
Disposable backup restore
```

It does not require application dependencies or a production application build. It verifies storage-transfer behavior independently from app startup.

This separation matters: container persistence and backup restore are different claims.

## What a green run would prove

A green run on a specific SHA would prove that, in the disposable GitHub-hosted environment:

- the current production storage topology can be recognized;
- PostgreSQL 18 custom dump/restore preserves the synthetic data;
- the private uploads volume can be archived and restored into a fresh volume;
- the restore works after source volumes have actually been deleted;
- the cleanup guard removes only owned disposable volumes.

## What it does not prove

It does not prove:

- backup of any existing NEXUS environment;
- VDS-provider snapshot behavior;
- recovery point objectives;
- recovery time objectives;
- consistency of a live production database and uploads during concurrent writes;
- encryption/retention policy for real private backups;
- a PostgreSQL major-version upgrade;
- restoration of Caddy state or certificates;
- an authorized resource download after a full restored application starts.

Those require an environment-specific operational rehearsal before release approval.
