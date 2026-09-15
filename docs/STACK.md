# MTA NEXUS — Technology Stack & Version Matrix

## Baseline Verification Date: September 2026

This document records the official technology stack choices, verified releases, compatibility matrix, and package pinning policies for MTA Nexus 1.0.

---

## 1. Core Runtime & Language

| Component | Target Version | Status | Notes |
|---|---|---|---|
| **Node.js** | `v24.20.0` LTS | Verified Installed | Active LTS. Native Web Crypto, fetch, streams, test runner support |
| **pnpm** | `9.15.9` | Verified Installed | Strict dependency isolation, workspace protocol (`workspace:*`) |
| **TypeScript** | `^5.7.0` | Verified Target | Strict mode enabled, project references, modern ECMAScript target |

---

## 2. Framework & Application Layer

| Library | Version | Role / Justification |
|---|---|---|
| **Next.js** | `16.3.5` | Monolithic application layer, App Router, React Server Components by default, Route Handlers, Server Actions |
| **React** | `19.3.0` | Modern React primitives (`useActionState`, `useOptimistic`, Actions, Server Components) |
| **React DOM** | `19.3.0` | React DOM renderer |

---

## 3. Database & Persistence Layer

| Library | Version | Role / Justification |
|---|---|---|
| **PostgreSQL** | `18.x` | Production relational database, transactions, constraints, full-text search, append-only ledgers |
| **Drizzle ORM** | `0.45.2` | Type-safe SQL builder & ORM, migration engine, zero runtime bloat, explicit schema definitions |
| **Drizzle Kit** | `^0.31.0` | Schema migrations and introspection tooling |
| **pg** / **postgres** | `^3.4.0` | Fast PostgreSQL driver with connection pooling |

---

## 4. Identity & Access Management

| Library | Version | Role / Justification |
|---|---|---|
| **Better Auth** | `1.7.5` | Modern TypeScript auth engine, session cookies (HttpOnly, SameSite), Discord OAuth, 2FA foundation, organization plugins |
| **Argon2** / WebCrypto | Native / `argon2` | Secure password hashing, brute-force resistance |

---

## 5. UI, Styling & Design System

| Library | Version | Role / Justification |
|---|---|---|
| **Tailwind CSS** | `4.3.3` | Next-gen CSS-first compiler, CSS variables for design tokens (light/dark/system) |
| **Base UI / Radix primitives** | Current stable | Accessible unstyled primitives for Dialog, Dropdown, Tabs, Tooltip, Sheet |
| **Lucide React** | `1.46.0` | Unified, consistent iconography across all modules |
| **clsx & tailwind-merge** | `2.1.1` & `3.7.0` | Predictable class concatenation and conflict resolution |

---

## 6. Validation & Contracts

| Library | Version | Role / Justification |
|---|---|---|
| **Zod** | `4.6.5` / `3.24.x` | Source-of-truth schemas for forms, API inputs, server actions, webhooks, domain validation |

---

## 7. Testing & Quality Assurance

| Tool | Version | Role / Justification |
|---|---|---|
| **Vitest** | `5.0.1` | Unit & integration test runner, fast execution, ESM native |
| **ESLint** | `^9.0.0` | Code quality, architecture boundary enforcement |
| **Prettier** | `^3.4.0` | Consistent code formatting |

---

## 8. Storage & Security

| Tool | Role |
|---|---|
| **Storage Providers** | Pluggable interface (`StorageProvider`) supporting Local Filesystem, AWS S3 / MinIO, and Object Storage |
| **Integrity** | SHA-256 content hashing on all uploads, state-machine tracking |
| **Security Controls** | Server-side authorization policies (`can(user, action, resource)`), opaque prefixed IDs, audit logging |
