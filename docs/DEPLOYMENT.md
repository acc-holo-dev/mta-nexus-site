# MTA NEXUS — Production Deployment Guide

## 1. Prerequisites
- Node.js 22+ LTS (Node.js 24 LTS recommended)
- pnpm 9+
- PostgreSQL 17 or 18
- S3-compatible Object Storage (MinIO, AWS S3, Cloudflare R2)

## 2. Environment Configuration
Copy `.env.example` to `.env` and configure credentials:
```bash
cp .env.example .env
```

## 3. Database Migration
Run Drizzle schema push / migrations:
```bash
pnpm db:generate
pnpm db:migrate
```

## 4. Production Build & Start
```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

## 5. Docker Compose Infrastructure
For standalone or staging deployment with Docker:
```bash
docker compose up -d
```
Starts PostgreSQL, MinIO S3 storage, and Mailpit SMTP server.
