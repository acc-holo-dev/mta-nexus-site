# Production upload proxy size boundary

OPS-001 aligns the production reverse-proxy request-size ceiling with the application build-upload envelope.

## Application limits

The build upload route allows:

- build file bytes: 64 MiB;
- multipart envelope allowance used by the early Content-Length guard: 1 MiB.

That makes the intended maximum request envelope 65 MiB.

## Caddy units

Caddy's `request_body max_size` accepts size strings parsed by `go-humanize`.

In that syntax:

- `MB` is decimal (1,000,000 bytes);
- `MiB` is binary (1,048,576 bytes).

The previous production Caddyfile used:

```text
max_size 65MB
```

which is 65,000,000 bytes. That is lower than the application's 64 MiB file limit alone (67,108,864 bytes), so a valid near-limit build could be rejected by the reverse proxy before the application saw it.

OPS-001 changes the proxy ceiling to:

```text
max_size 65MiB
```

which is exactly 68,157,440 bytes and matches:

```text
64 MiB file + 1 MiB multipart allowance
```

## Layering

The proxy limit is the first production defense against oversized and chunked request bodies.

The application still keeps:

- declared Content-Length rejection;
- multipart media-type validation;
- actual `file.size` validation;
- scanner and storage gates.

The proxy limit therefore does not replace route-level validation.

## Acceptance

The production smoke must still adapt the exact production Caddyfile successfully and exercise the proxied upload boundary on the accepted candidate. A source/test match alone does not prove the deployed proxy behavior.
