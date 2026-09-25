# Resource claim request IP handling

RESOURCE-010 fixes the request-IP boundary used by the free-resource claim rate limiter.

The low-level security helper `getClientIp(headers, expectedProxySecret)` deliberately requires a trusted proxy secret. Calling it without that secret throws instead of trusting spoofable forwarding headers.

The claim route previously called that low-level helper with only request headers. In production this could turn a normal claim request into a 500 before authentication or claim processing.

The route now uses the same application wrapper as login/registration:

```text
getTrustedRequestIp(request)
```

The wrapper:

- uses `TRUSTED_PROXY_SECRET` before accepting proxy forwarding headers;
- refuses missing proxy configuration in production;
- uses a stable local-direct identity outside production when no proxy secret is configured;
- passes the verified secret into the low-level IP parser.

This change affects only abuse-rate-limit subject derivation. It does not change claim authorization, entitlement semantics or pricing rules.
