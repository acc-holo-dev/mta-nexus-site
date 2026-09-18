# Production deployment

This is the single-VDS deployment for the closed beta. It does not deploy automatically; run it only after DNS for `nexus-mta.com` points to the VDS.

## What runs on the VDS

- Next.js application;
- PostgreSQL 18, reachable only from the application container;
- ClamAV 1.5, reachable only from the application container;
- Caddy, which obtains TLS certificates and exposes only ports 80/443;
- Docker named volumes for database, uploads, and Caddy certificates.

The target requires at least 4 GB RAM because ClamAV loads its signature database in memory. No SMTP or payment provider is required.

## Prepare the host

Install Docker Engine with Compose plugin, clone the `dev` branch, then create `.env` from `.env.example`. Set these production-only values:

```dotenv
DOMAIN=nexus-mta.com
ACME_EMAIL=your-email@example.com
POSTGRES_USER=nexus
POSTGRES_PASSWORD=generate-a-long-random-password
POSTGRES_DB=mta_nexus
AUTH_SECRET=generate-a-unique-secret-of-at-least-32-characters
```

Keep `.env` outside git. Do not expose port 5432 in a firewall or Docker mapping.

## Validate and start

```bash
docker compose -f compose.production.yaml config
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml ps
curl -fsS https://nexus-mta.com/api/health
```

The app applies database migrations before it starts. Caddy terminates TLS and rejects request bodies above 65 MiB before they reach Next.js.

## Backups and restore drill

Enable VDS provider backups as chosen. In addition, regularly export the database and preserve uploads:

```bash
docker compose -f compose.production.yaml exec -T postgres pg_dump -U nexus mta_nexus > mta-nexus.sql
docker run --rm -v mta-nexus-site_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tar.gz -C /data .
```

Before inviting beta users, test restoring both artefacts on a disposable VDS. Provider backups are not a substitute for a restore drill.

## Upgrade

PostgreSQL major-version upgrades require a tested dump/restore or `pg_upgrade`; never attach an existing PostgreSQL 16 data volume directly to PostgreSQL 18.

```bash
git checkout main
git pull --ff-only
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml ps
```

Never run multiple application replicas yet: rate limiting is intentionally in-memory for this single-instance beta.
