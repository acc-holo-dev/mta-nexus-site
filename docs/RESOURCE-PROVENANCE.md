# Resource build provenance

RESOURCE-001 exposes the build facts MTA NEXUS already records without turning them into stronger claims than the evidence supports.

## Artifact identity

A resource upload is read into bytes, scanned, and passed to the storage provider. The storage result supplies the SHA-256 recorded on the build.

The public release card can now expose the complete recorded SHA-256 in a selectable code block.

The authorized download response also exposes:

```text
X-Content-SHA256: <recorded build SHA-256>
```

This gives users and operators one stable artifact identifier across the build record, resource page and download response.

## Separate trust facts

The provenance panel intentionally keeps these facts separate:

- build publication state;
- SHA-256 artifact identity;
- malware scan status;
- scanner identity, when recorded;
- scan timestamp, when recorded;
- MTA version target;
- signing state.

A SHA-256 checksum is not a malware verdict.

A clean malware scan is not a cryptographic signature.

`isSigned: false` is rendered as **Not available**, not as a failed verification.

## Scan wording

The UI uses bounded states:

- `clean` → **Clean scan recorded**
- `malicious` → **Blocked as malicious**
- `error` → **Scanner unavailable**
- `not_scanned` → **Scan not recorded**

The helper never invents a scanner identity or timestamp.

## Scope

RESOURCE-001 does not:

- implement package signing;
- verify a GitHub release;
- unpack or interpret MTA `meta.xml`;
- claim source-code provenance;
- claim an artifact is safe because a checksum exists.

Those are separate future capabilities.
