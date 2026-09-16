# Production deployment

This guide targets one small Linux VPS and the initial **$20–30/month** ceiling. The closed beta is designed for one application process, PostgreSQL 16, a local upload directory on the system disk, and a TLS reverse proxy.

## Chosen target

- provider: Hetzner Cloud;
- location: Finland or Germany;
- baseline: shared instance with 4 GB RAM;
- primary domain: `nexus-mta.com`;
- fallback domain: `nexus-mta.pro`;
- email: disabled until an SMTP provider is deliberately connected.

Use the plan selector at creation time: pricing changes, but the instance plus provider backups must remain within the $30/month ceiling.

## Runtime requirements

- Node.js 22+
- pnpm 9+
- PostgreSQL 16
- HTTPS reverse proxy
- persistent directories for PostgreSQL and resource uploads

## Reverse-proxy security contract

The application port must only be reachable from the local reverse proxy, never directly from the internet. The proxy must:

- terminate HTTPS and redirect HTTP to HTTPS;
- replace, rather than append to, inbound `X-Forwarded-For` and `X-Real-IP` headers;
- reject request bodies larger than **65 MiB** before they reach Next.js;
- apply reasonable connection and request timeouts.

The application independently enforces a 64 MiB asset limit, but multipart parsing can allocate memory before application validation. The proxy body limit is therefore a production requirement.

## Production environment

```dotenv
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://nexus-mta.com
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
AUTH_SECRET=GENERATE_A_UNIQUE_SECRET_OF_AT_LEAST_32_CHARACTERS

STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=/var/lib/mta-nexus/uploads

EMAIL_PROVIDER=disabled
SMTP_FROM=no-reply@nexus-mta.invalid
```

The S3 option is reserved but not implemented. Selecting it raises an explicit runtime error; it never silently stores data on the application disk.

## Install and verify

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm check
NODE_ENV=production pnpm start
```

Check `GET /api/health` through the HTTPS domain after startup.

## Backups

Enable Hetzner Cloud Backups. They create daily copies and keep seven slots, but do not include attached volumes. Keep PostgreSQL and `/var/lib/mta-nexus/uploads` on the backed-up system disk in this phase.

Also create a daily archive of the database and uploads, then test a restore before inviting users. Provider backups and a tested restore are the minimum, not a substitute for checking that data can be recovered.

## Upgrade

```bash
git fetch --all --prune
git checkout main
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm check
sudo systemctl restart mta-nexus
```

## Single-instance limitations

The in-memory rate limiter assumes one application process. Do not scale horizontally until rate limiting and session-sensitive operational controls are moved to shared infrastructure.
