# Production deployment

This guide targets one small Linux VPS, which fits the initial **$20–30/month** budget better than a distributed platform. Use one application process, PostgreSQL 16, a persistent upload volume, and Caddy or another TLS reverse proxy.

## Required external inputs

Before production can be started, the owner must provide:

1. a domain and DNS control;
2. the chosen VPS/provider and access method;
3. SMTP credentials and a verified sender address;
4. backup destination and retention preference.

Paid commerce additionally requires jurisdiction/legal terms and a selected payment provider. It is not part of the free closed beta.

## Runtime requirements

- Node.js 22+
- pnpm 9+
- PostgreSQL 16
- HTTPS reverse proxy
- persistent directories for PostgreSQL and resource uploads

## Production environment

Production validation is fail-closed. At minimum configure:

```dotenv
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://nexus.example.com
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
AUTH_SECRET=GENERATE_A_UNIQUE_SECRET_OF_AT_LEAST_32_CHARACTERS

STORAGE_PROVIDER=local
STORAGE_LOCAL_PATH=/var/lib/mta-nexus/uploads

EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@example.com
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

Never deploy before a database backup. Database migrations are forward-only; test restore procedures before the closed beta.

## Backup minimum

- nightly PostgreSQL dump;
- daily snapshot or archive of `/var/lib/mta-nexus/uploads`;
- seven daily copies plus four weekly copies;
- one restore drill before inviting users.

## Single-instance limitations

The in-memory rate limiter assumes one application process. Do not scale horizontally until rate limiting and session-sensitive operational controls are moved to shared infrastructure.
