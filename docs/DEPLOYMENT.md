# Production deployment — validation required

> **Release is not approved by this document.** See the [release map](RELEASE-READINESS.md), reviewed 2026-09-24. The recipes below are an existing operational draft, not a verified runbook.
>
> **PostgreSQL 18 data-volume warning:** both Compose files now mount `pgdata` at `/var/lib/postgresql`, covering the default `/var/lib/postgresql/18/docker`. Earlier revisions mounted `/var/lib/postgresql/data` and failed the isolated startup regression. BETA-001 verifies persistence on fresh named volumes; it does not migrate or validate any existing environment. Before starting, recreating, or upgrading an environment with existing or unknown data, identify the actual `PGDATA`, mounted volumes, database version, and recovery path. Do not change the mount blindly and do not delete volumes to fix startup. See the [official image documentation](https://github.com/docker-library/docs/blob/master/postgres/content.md#pgdata).

This is the proposed single-VDS deployment for the closed beta. It does not deploy automatically. Production execution requires all release gates, owner approval, and DNS for the chosen domain pointing to the intended VDS; DNS alone is insufficient.

## What runs on the VDS

- Next.js application;
- PostgreSQL 18, reachable through the Compose network and not published to the host;
- ClamAV 1.5, reachable through the Compose network and not published to the host;
- Caddy, which obtains TLS certificates and publishes ports 80/443;
- Docker named volumes for database, uploads, and Caddy certificates.

The previous sizing target is at least 4 GB RAM with ClamAV included. Capacity and scanner startup must be measured on the chosen host; this is not a verified resource guarantee. Paid commerce and production email remain disabled; the account-recovery policy still needs an explicit decision in the release map.

## Prepare the host — only after the release gates pass

Install Docker Engine with the Compose plugin and check out the explicitly approved release SHA/tag from `main`, not the moving `dev` branch. Create `.env` from `.env.example` and set these production-only values:

```dotenv
DOMAIN=nexus-mta.com
ACME_EMAIL=your-email@example.com
POSTGRES_USER=nexus
POSTGRES_PASSWORD=generate-a-long-random-password
POSTGRES_DB=mta_nexus
AUTH_SECRET=generate-a-unique-secret-of-at-least-32-characters
```

Keep `.env` outside git. Do not expose port 5432 in a firewall or Docker mapping. Record the chosen commit and image identifiers in the deployment record.

## Validate and start — historical recipe pending verification

The BETA-001 storage test is not approval to execute this recipe. Full application startup remains BETA-002/003. Existing or unknown data requires inventory and a tested recovery/transfer plan before a volume-layout change; all deployments require an approved release candidate.

```bash
docker compose -f compose.production.yaml config
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml ps
curl -fsS https://nexus-mta.com/api/health
```

Do not publish the rendered Compose configuration: it can contain secrets. The current app command applies database migrations before startup; migration failure and recovery need their own rehearsal. A successful `/api/health` response alone does not prove database, storage, scanner, or user-journey readiness. The Caddy request-size and proxy configuration also belong in runtime verification.

## Existing database inventory — before any layout change

No existing NEXUS environment was inspected during BETA-001. Do not infer that there is no data.

Record the running database version (`SHOW server_version`), actual directory (`SHOW data_directory`), container ID, image identifier, and mount destinations/types/names. Inspect only the required fields; do not publish container environment variables or `.env` contents. Identify anonymous volumes as well as the intended named volume. If the container is stopped or inaccessible, preserve the volumes and record the inventory as incomplete rather than starting a different image against them.

For an existing database, verify a backup and rehearse a version-appropriate transfer/restore on a separate environment. Replacing the YAML mount target is not a data migration and does not move files. Do not use `docker compose down -v`, volume pruning, or blanket cleanup on existing or unknown data.

## Backups and restore drill

VDS-provider backups remain the chosen backup mechanism. Confirm what the actual provider backup covers and restore both the database and private uploads on a disposable environment before inviting users. No restore has been demonstrated by this document. BETA-001 preserves the same named volume while replacing its container; this is not a backup restore.

The following exports are retained as reference tools for a planned restore drill, not a newly mandated parallel backup service. First identify the real uploads volume from the running Compose project; the volume name in an example must never be assumed to match the host.

```bash
# Reference only: use the actual configured user/database.
docker compose -f compose.production.yaml exec -T postgres pg_dump -U nexus mta_nexus > mta-nexus.sql
```

A database dump alone does not contain uploaded archives. The verified runbook must capture and restore the actual uploads volume, account for consistency between database and files, protect exported private data, and validate a sample authorized download after restoration.

## Upgrade

Use an explicitly approved SHA/tag from `main` for upgrades as well as first installation. Record the previous candidate and a recovery plan before migrations. A code rollback alone does not necessarily undo a database migration.

PostgreSQL major-version upgrades require a tested dump/restore or `pg_upgrade`; never attach an existing PostgreSQL 16 data volume directly to PostgreSQL 18. Changing the YAML mount path is not an upgrade procedure. The release map requires a separate restore rehearsal before this operational draft can be marked verified.

Never run multiple application replicas yet: rate limiting is intentionally in-memory for the single-instance beta. Deployment, volume cleanup, data migration, and paid-provider activation require their own explicit approval and are not authorized by a documentation update.
