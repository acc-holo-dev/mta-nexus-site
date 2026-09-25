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
4. applies every current `packages/db/migrations/*.sql` migration with `ON_ERROR_STOP=1`;
5. writes two database probe rows and records a schema fingerprint;
6. writes two private-upload probe files;
7. creates a custom-format `pg_dump` containing the current application schema plus probe data;
8. creates a compressed uploads archive;
9. records SHA-256 for both backup files;
10. destroys the source containers and source volumes;
11. re-checks both backup SHA-256 values after source destruction, before restore.

Only after the source volumes are confirmed removed does the restore phase begin.

The restore phase:

1. creates different empty disposable volumes;
2. starts a fresh PostgreSQL cluster;
3. restores the database using `pg_restore`;
4. extracts the uploads archive into the fresh uploads volume;
5. verifies the exact database rows;
6. compares restored table/column/index/constraint fingerprint with the migrated source database;
7. verifies both upload file contents;
8. removes all restore containers and owned volumes.

Both temporary backup files are forced to owner-only mode `0600` before restore. The workflow checkout also disables persisted Git credentials. The temporary backup files are removed when the rehearsal completes.

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
- all current SQL migrations can be applied to the disposable source database;
- PostgreSQL 18 custom dump/restore preserves the current migrated application schema and synthetic data;
- backup files retain their recorded SHA-256 after source volumes are destroyed;
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
