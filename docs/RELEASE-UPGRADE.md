# Existing-installation release and recovery

This runbook prepares an operator-reviewed Docker deployment. It does not deploy
production, select a target host, or authorize deletion/restoration of its data.
Use the existing production Compose project name and its protected environment
file throughout. Changing the project name during a normal update creates different
volumes and can make an intact installation appear empty.

## Acceptance evidence

Select one exact `main` commit and wait for **CI**, **Resource browser**,
**Account browser**, and **Directory browser** to succeed on that commit.
Keep these CI artifacts outside the runner before their 14-day retention expires:

| Evidence | What it proves |
| --- | --- |
| `core-release-evidence-<sha>-<attempt>` | Repository identity, migrations, lint, types, tests, default production build |
| `release-upgrade-<sha>-<attempt>` | Real Drizzle upgrade from schema 0024 to 0025; failed DDL and ledger rollback; retry; idempotency; legacy rows and new structured notifications |
| `backup-restore-<sha>-<attempt>` | Destroyed synthetic source restored into new owned volumes; schema, migration ledger, author, resource, trusted build, entitlement, notification and uploads preserved |

Require `status: "PASS"`, the intended `sha`, and all verification/cleanup flags
to be true in the upgrade and restore reports. A downloaded report alone is not
success. These reports extend the core release evidence; they are separate required
workflow steps, not additional gates silently inferred by the core JSON summary.

The upgrade fixture intentionally pins 0024 → 0025 and fails when a new migration
is added. Review and extend it with the next release's old-schema fixtures and
data-changing effects. Its injected failure is synthetic and occurs after the
real 0025 SQL, within Drizzle's transaction. It proves database rollback/retry,
not recovery from host failure or compatibility of an older application image.
Backup acceptance uses synthetic data and the production PostgreSQL/storage
topology; rehearse separately against a protected copy of the target dataset.

## Before maintenance

1. Record the target hostname, current project name, application image ID/digest,
   deployed commit, PostgreSQL major version and actual volume names/mount targets.
   Keep the old application image and its original checkout/Compose/proxy files.
   Save the image with `docker image save` if it is not available from a registry.
2. Record `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`
   from the target database. Review pending SQL against this inventory. Do not edit
   applied SQL or its journal. Migration 0025 only adds nullable notification JSON;
   existing notification title/message/read state remain the fallback.
3. Review older pending migrations too: 0020 retires unsafe legacy builds and can
   return products to draft; 0024 normalizes `tool` and rejects unknown types.
   This runbook does not cover a PostgreSQL major-version or storage-layout change.
4. Build the candidate from the selected commit before downtime, using an immutable
   image tag/digest. Retain the matching configuration privately, including recovery
   mail encryption keys needed to read any existing outbox. Do not rotate secrets
   as part of a routine update or put them in release artifacts.
5. Restore a recent database dump and uploads archive to an isolated installation,
   apply the candidate, and check real representative accounts/resources there.
   Disable real outbound mail and keep it away from public traffic.

## Consistent backup and update

Schedule a maintenance window. Stop public ingress, the app, and every enabled
writer (including the optional account-mail worker and external jobs). Keep
PostgreSQL running for the dump. Capture the app container ID before stopping it;
the stopped container must remain available for its uploads mount.

Example backup commands below require operator-selected values. `PRODUCTION_ENV`
is an absolute protected environment-file path; `RELEASE_DIR` is the existing
deployment checkout; `PROJECT` is its unchanged Compose project name.
`BACKUP_DIR` must be a new private directory outside the upload/database volumes.

```bash
set -eu
umask 077
dc() {
  docker compose --env-file "$PRODUCTION_ENV" --project-name "$PROJECT" \
    --file "$RELEASE_DIR/compose.production.yaml" "$@"
}
app_id=$(dc ps --quiet app)
postgres_id=$(dc ps --quiet postgres)
test -n "$app_id"
test -n "$postgres_id"
old_image=$(docker inspect --format '{{.Image}}' "$app_id")
postgres_image=$(docker inspect --format '{{.Image}}' "$postgres_id")
mkdir -m 700 "$BACKUP_DIR"
dc stop caddy app
# Stop enabled writer services/jobs using their actual configured names too.
# Proceed only after all writers are stopped.
docker exec "$postgres_id" sh -eu -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$BACKUP_DIR/database.dump"
docker run --rm --network none --entrypoint tar \
  --volumes-from "$app_id:ro" "$postgres_image" \
  -C /data/uploads -czf - . > "$BACKUP_DIR/uploads.tar.gz"
test -s "$BACKUP_DIR/database.dump"
test -s "$BACKUP_DIR/uploads.tar.gz"
printf '%s\n' "$old_image" > "$BACKUP_DIR/previous-app-image.txt"
(cd "$BACKUP_DIR" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
```

Retain the dump, uploads, image and matching protected configuration together.
Checksums detect accidental changes; they do not replace a successful restore.
If any backup command fails, do not start the candidate. A `pg_dump` alone cannot
keep database build records and files consistent while uploads continue writing.

Use a reviewed Compose override that sets the candidate `app.image` to its retained
immutable image. Start it with `up --detach --no-build --pull never --wait
--wait-timeout 300 app` while ingress stays stopped. Include the same override in
every command. The image entrypoint applies migrations before starting HTTP;
an app restart can retry migrations, so stop a repeatedly failing candidate before
investigating. Do not use `down --volumes`, `volume prune` or `db:seed` on this host.

After app readiness succeeds, check `node scripts/check-local-readiness.mjs`
inside the app, compare the migration ledger to the candidate journal, and verify
the expected resource/build/entitlement/notification counts and upload checksums.
Start any enabled worker with the same candidate and retained mail keys. Restore
ingress only after these checks, then verify through HTTPS:

- login, session revocation and the configured recovery-mail path;
- catalog, existing free acquisition and a downloaded file's length/SHA-256;
- author metadata edit, new upload, trusted scan and moderation notification;
- RU/EN workspace and inbox, plus the official server-directory path.

An unconfigured email provider is not successful delivery. If a critical flow
fails, return to maintenance and select recovery before allowing new writes.

## Recovery decision

For an additive migration, returning to the old image may be possible only after
checking that image against the upgraded schema and current data in isolation.
The CI upgrade fixture does not prove old-image compatibility. Never delete a
migration-ledger row or drop the new column merely to make the old version start.

When image-only rollback is unverified or the migration changed data, recover
the **paired pre-update database and uploads**, with their matching old image and
configuration, into **new empty volumes** under a separate recovery project.
Keep the failed installation stopped and retain its volumes for investigation.

1. Verify `SHA256SUMS` and the backup identity. Start only the recovery PostgreSQL
   service on its empty volume, using the original PostgreSQL major version.
2. Restore the custom dump with `pg_restore --exit-on-error --no-owner
   --no-privileges` into that empty database. Stop on any error; do not use
   `--clean` against the failed or an unknown database.
3. Extract the paired archive into the recovery project's empty uploads volume,
   preserving file ownership. Confirm storage keys, lengths and hashes against
   restored build rows and compare the restored migration ledger to the backup.
4. Start the retained old app/worker with that restored database and storage and
   the old configuration; repeat readiness and HTTPS critical journeys. Route
   ingress to the recovery installation only after verification.
5. Document any writes made after the backup: restoring a snapshot loses them.
   Keep that interval empty through maintenance, or plan explicit reconciliation.

Do not copy a raw PostgreSQL volume between major versions. Preserve both the
failed volumes and the backup until the recovered installation is confirmed stable.
