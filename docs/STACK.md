# MTA NEXUS — Technology Stack & Version Matrix

## Baseline Verification Date: September 2026

This document records the official technology stack choices, verified releases, compatibility matrix, and package pinning policies for MTA Nexus 1.0.

---

## 1. Core Runtime & Language

| Component | Target Version | Status | Notes |
|---|---|---|---|
| **Node.js** | `v26` (Docker/CI baseline) | Verified Target | Current release. Native Web Crypto, fetch, streams, test runner support |
| **pnpm** | `12.4.2` | Verified Installed | Strict dependency isolation, workspace protocol (`workspace:*`) |
| **TypeScript** | `7.0.2` | Verified Target | Strict mode enabled, project references, modern ECMAScript target |

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
| **PostgreSQL** | `18.x` | Production relational database, transactions, constraints and bounded relational search |
| **Drizzle ORM** | `0.45.2` | Type-safe SQL builder & ORM, migration engine, zero runtime bloat, explicit schema definitions |
| **Drizzle Kit** | `0.31.10` | Schema migrations and introspection tooling |
| **postgres** | `3.4.9` | Fast PostgreSQL driver with connection pooling |

---

## 4. Identity & Access Management

| Library | Version | Role / Justification |
|---|---|---|
| **Authentication** | Current local session/auth services | httpOnly sessions and scrypt password hashing; external OAuth is a later gate |
| **Password hashing** | Node.js `scrypt` | Salted password hashing and timing-safe verification; Argon2 is not installed |

---

## 5. UI, Styling & Design System

| Library | Version | Role / Justification |
|---|---|---|
| **Tailwind CSS** | `4.3.3` | Next-gen CSS-first compiler, CSS variables for design tokens (light/dark/system) |
| **UI primitives** | Workspace components | Locally maintained Dialog, Tabs, form and platform primitives; Base UI/Radix are not installed |
| **Lucide React** | `1.47.0` | Unified, consistent iconography across all modules |
| **clsx & tailwind-merge** | `2.1.1` & `3.7.0` | Predictable class concatenation and conflict resolution |

---

## 6. Validation & Contracts

| Library | Version | Role / Justification |
|---|---|---|
| **Zod** | `4.6.5` | Source-of-truth schemas for forms, API inputs, server actions, webhooks, domain validation |

---

## 7. Testing & Quality Assurance

| Tool | Version | Role / Justification |
|---|---|---|
| **Vitest** | `5.0.1` | Unit & integration test runner, fast execution, ESM native |
| **Static checking** | TypeScript project references | `tsc -b` is the current static quality gate; ESLint and Prettier are not installed |

---

## 8. Storage & Security

| Tool | Role |
|---|---|
| **Storage Providers** | `StorageProvider` interface with a local private-filesystem implementation; S3 mode fails closed until an adapter exists |
| **Integrity** | SHA-256 content hashing on all uploads, state-machine tracking |
| **Security Controls** | Server-side authorization policies (`can(user, action, resource)`), opaque prefixed IDs, audit logging |
