# Production deployment — release approval required

> **Release is not approved by this document.** See the [release map](RELEASE-READINESS.md), updated 2026-09-24. BETA-002 covers the [local Docker quickstart](../README.md). BETA-003 adds a separate production-image smoke test in disposable CI; its exact result and commit are recorded in the release map. It does not validate an existing VDS, public DNS, public certificate issuance or all user journeys.
>
> **PostgreSQL 18 data-volume warning:** both Compose files mount `pgdata` at `/var/lib/postgresql`, covering the default `/var/lib/postgresql/18/docker`. Earlier revisions mounted `/var/lib/postgresql/data` and failed the isolated startup regression. BETA-001 verifies persistence on fresh named volumes; it does not migrate or validate any existing environment. Before starting, recreating, or upgrading an environment with existing or unknown data, identify the actual `PGDATA`, mounted volumes, database version, and recovery path. Do not change the mount blindly and do not delete volumes to fix startup. See the [official image documentation](https://github.com/docker-library/docs/blob/master/postgres/content.md#pgdata).

This is the proposed single-VDS deployment for the closed beta. It does not deploy automatically. Production execution requires all release gates, owner approval, and DNS for the chosen domain pointing to the intended VDS; DNS alone is insufficient. Never deploy the default development Compose as a production shortcut.

## What runs on the VDS

- Next.js application using the production image, not the `development` target;
- PostgreSQL 18, reachable through the Compose network and not published to the host;
- ClamAV 1.5, reachable through the Compose network and not published to the host;
- Caddy, which obtains TLS certificates and publishes ports 80/443;
- Docker named volumes for database, uploads, and Caddy certificates.

The previous sizing target is at least 4 GB RAM with ClamAV included. Capacity and scanner startup must be measured on the chosen host; this is not a verified resource guarantee. Paid commerce and production email remain disabled. D3 enrollment is verified only in disposable CI: the standard production Compose intentionally omits the mail-encryption/abuse keys and dispatcher, so enrollment POST fails closed until a separately approved mail rollout.

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

`ACME_EMAIL` is required by this Caddyfile and is explicitly passed to the Caddy container. An empty value now fails Compose interpolation rather than producing an obscure Caddy parsing error. Use an operator-controlled contact address; this variable does not configure application email or account recovery.

Keep `.env` outside git. Do not expose port 5432 in a firewall or Docker mapping. Record the chosen commit and image identifiers in the deployment record. Local-development credentials must not be used in production.

## Validate and start — only for an approved environment

The CI checks are not approval to execute this recipe on a real host. Existing or unknown data requires inventory and a tested recovery/transfer plan before a volume-layout change; all deployments require an approved release candidate. Public DNS/ACME, sizing, backup restoration and user journeys still need environment-specific acceptance.

```bash
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml ps
curl -fsS https://nexus-mta.com/api/health
```

Do not publish a fully rendered Compose configuration: it can contain secrets. The production app command applies migrations before startup. A failing migration must stop startup; a code rollback alone does not undo a partially applied database change. A successful `/api/health` response proves neither storage nor scanner verdicts or user-journey readiness. The Caddy request-size rule still needs boundary testing with the real upload flow.

## BETA-003 production smoke — not a deployment command

The existing CI workflow runs `scripts/check-production-startup.sh` only on a disposable GitHub-hosted runner using its default Docker daemon. The script rejects other environments. It combines `compose.production.yaml` with the explicit `compose.production-ci.yaml` overlay; do not use that overlay on the VDS.

The overlay selects the real Dockerfile `runtime` target and leaves application production validation enabled. It changes only test infrastructure: disposable credentials/domain/volumes, synthetic D3 mail/abuse keys, restart policy, loopback ports 8080/8443, and a test Caddyfile. The synthetic keys exist only to exercise encrypted enrollment in browser CI; they are not a production secret-provisioning design. The latter is derived from the production file by adding `local_certs` and `skip_install_trust`; proxy and body-limit directives remain unchanged. The original production Caddyfile is adapted first to detect missing environment wiring.

Before starting Caddy, the test verifies that every explicit certificate issuer is internal. HTTPS requests use the copied disposable root certificate with `curl --cacert` and the reserved test hostname; certificate verification is not disabled. Public ACME accounts, real domains and working databases are not used. See [Caddy local_certs](https://caddyserver.com/docs/caddyfile/options#local-certs) and [Compose override semantics](https://docs.docker.com/reference/compose-file/merge/). The overlay requires Compose 2.24.4 or later for `!override`, so public production ports cannot accidentally remain exposed alongside test ports.

The smoke checks production startup, migrations, HTTPS proxy health/home, HTTP redirect, non-root application, private dependency ports, read/write uploads, app replacement with retained database/file probes, refusal of invalid configuration and migration failure, and database outage/recovery. Consult CI and the release map for what actually passed; a test being present is not a passing result. Its cleanup removes only the newly created UUID project. It is not a cleanup recipe for user environments.

## Existing database inventory — before any layout change

No existing NEXUS environment was inspected during BETA-001–003. Do not infer that there is no data.

Record the running database version (`SHOW server_version`), actual directory (`SHOW data_directory`), container ID, image identifier, and mount destinations/types/names. Inspect only the required fields; do not publish container environment variables or `.env` contents. Identify anonymous volumes as well as the intended named volume. If the container is stopped or inaccessible, preserve the volumes and record the inventory as incomplete rather than starting a different image against them.

For an existing database, verify a backup and rehearse a version-appropriate transfer/restore on a separate environment. Replacing the YAML mount target is not a data migration and does not move files. Do not use `docker compose down -v`, volume pruning, or blanket cleanup on existing or unknown data.

## Backups and restore drill

VDS-provider backups remain the chosen backup mechanism. Confirm what the actual provider backup covers and restore both the database and private uploads on a disposable environment before inviting users. No restore has been demonstrated by this document. Keeping the same named volumes while replacing containers is not a backup restore.

The following exports are retained as reference tools for a planned restore drill, not a newly mandated parallel backup service. First identify the real uploads volume from the running Compose project; the volume name in an example must never be assumed to match the host.

```bash
# Reference only: use the actual configured user/database.
docker compose -f compose.production.yaml exec -T postgres pg_dump -U nexus mta_nexus > mta-nexus.sql
```

A database dump alone does not contain uploaded archives. The verified runbook must capture and restore the actual uploads volume, account for consistency between database and files, protect exported private data, and validate a sample authorized download after restoration.

## Upgrade

Use an explicitly approved SHA/tag from `main` for upgrades as well as first installation. Record the previous candidate and a recovery plan before migrations. A code rollback alone does not necessarily undo a database migration.

PostgreSQL major-version upgrades require a tested dump/restore or `pg_upgrade`; never attach an existing PostgreSQL 16 data volume directly to PostgreSQL 18. Changing the YAML mount path is not an upgrade procedure. The release map requires a separate restore rehearsal before the real operational runbook can be marked verified.

Never run multiple application replicas yet: rate limiting is intentionally in-memory for the single-instance beta. Deployment, volume cleanup, data migration, and paid-provider activation require their own explicit approval and are not authorized by a documentation update.
