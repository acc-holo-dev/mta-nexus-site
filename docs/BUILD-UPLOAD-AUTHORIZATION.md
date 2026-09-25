# Build upload preflight authorization

RESOURCE-012 moves build-target authorization ahead of expensive upload work.

## Previous ordering

The build upload route authenticated and rate-limited the request, then:

1. parsed multipart form data;
2. read the build into memory;
3. ran the malware scanner;
4. wrote a private storage asset;
5. only then reached `productService.releaseBuild()`, where product ownership was checked.

An unauthorized authenticated caller could not publish a build, but could still spend multipart parsing, memory, scanner and storage resources against a product they did not manage.

## New ordering

After session and rate-limit checks, the route resolves the product ID and calls:

```text
productService.assertCanReleaseBuild(productId, user)
```

before Content-Length processing, media-type validation, multipart parsing, file reads, scanner calls or storage writes.

The preflight uses the canonical organization-aware product-management contract from AUTHZ-001.

## Defense in depth

`productService.releaseBuild()` calls the same assertion again after the asset is uploaded.

The second check is intentional. The route preflight protects expensive infrastructure work; the service-level recheck remains the authoritative mutation boundary and protects against state/authorization changes between preflight and persistence.

## Error behavior

Before reading the body:

- missing product → 404;
- paid resource while commerce is disabled → 422;
- unmanaged product → 403;
- declared request larger than the closed-beta envelope → 413;
- non-`multipart/form-data` request → 415.

The build upload rate limit still runs before product lookup.

## Dependencies

This candidate is stacked on AUTHZ-001 / #34.

RESOURCE-005 / #25 modifies the same upload route with fail-closed scanner behavior. #25 must be accepted before RESOURCE-012 is retargeted to `dev`; then this branch must be refreshed so both guarantees are present:

- unauthorized requests never reach the scanner;
- authorized requests never store a build when scanning is unavailable.
