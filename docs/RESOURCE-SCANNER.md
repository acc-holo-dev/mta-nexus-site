# Resource scanner fail-closed behavior

RESOURCE-005 tightens the existing ClamAV upload path without changing the moderation model.

## Publication invariant

A resource build can be approved only when its stored scan status is `clean`.

This remains enforced in `ProductService.reviewBuild`. A checksum, file signature match, upload success or moderator action cannot substitute for a clean malware verdict.

Production configuration also continues to require:

```text
BUILD_SCANNER=clamav
```

A production application configured with disabled scanning fails configuration validation.

## Upload verdicts

After extension/signature checks and before storage:

- `clean` — continue to private storage and submit the build for moderation;
- `malicious` — reject with HTTP 422 and do not store the artifact;
- `error` — return HTTP 503 + `Retry-After: 30`, do not store the artifact, and ask the author to retry later;
- `not_scanned` — remains an explicit non-production/manual state for environments where the scanner is deliberately disabled.

Previously a scanner infrastructure error could create a private `pending_review` build that could never be approved and had no rescan workflow. RESOURCE-005 removes that dead-end for ClamAV errors.

## ClamAV transport

The INSTREAM writer sends data in 64 KiB chunks.

Each protocol write checks the Node socket return value. When `socket.write(...)` reports backpressure, the writer waits for `drain` before sending more bytes.

If the socket closes or errors while waiting for drain, the scan resolves as a scanner error rather than continuing to enqueue the remaining artifact in process memory.

The existing 30-second scanner socket timeout remains in place.

## Scope boundary

This change does not claim:

- archive extraction or recursive content interpretation;
- that signature matching proves an archive is safe;
- runtime Lua security analysis;
- sandbox execution;
- external scanner redundancy;
- automatic rescan of old error/not-scanned builds;
- scanner availability under production load.

Those require separate acceptance evidence.
