# Private route cache policy

SECURITY-001 audits cookie/auth-dependent GET route responses.

## Policy

A GET response whose representation depends on the current account, session, role, entitlement or private account state must explicitly return:

```http
Cache-Control: private, no-store
Vary: Cookie
```

The policy applies to success and explicit deny/error branches produced by the route.

The goal is not to rely on framework heuristics or status codes to keep account-specific representations out of intermediary caches.

## Audited candidate routes

SECURITY-001 covers:

- `GET /api/auth/context`;
- `GET /api/notifications/preferences`;
- `GET /api/notifications`;
- `GET /api/reports`;
- `GET /api/verification`;
- `GET /api/follow`;
- `GET /api/products/:id/download`.

The download route applies the same private policy to JSON denial/error responses and to the successful artifact stream.

Existing account routes such as session status, session management and recovery-email status already use private/no-store semantics and are not rewritten here.

## Follow route

`GET /api/follow` is covered directly by SECURITY-001 because its representation changes with the current session. Anonymous, authenticated and validation-error responses all carry the private cache contract.

SERVER-004 (#15) may still touch the same route for product behavior and must preserve these headers when rebased.

## Public routes

Public discovery reads remain publicly cacheable where their payload is not account-specific, including:

- public products;
- public servers;
- published content;
- search results;
- official MTA directory reads.

This change does not turn those routes private.

## Scope boundary

This is a response-cache policy audit, not a claim that all API security is complete.

It does not itself prove:

- authorization correctness;
- CSRF protection for mutations;
- CDN or reverse-proxy production configuration;
- browser cache implementation behavior;
- all unhandled framework error responses;
- route-level rate limiting;
- data minimization of every payload.

Those remain separate acceptance questions.
