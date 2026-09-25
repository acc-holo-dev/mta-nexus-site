# MTA Resource Inspector foundation

RESOURCE-002 introduces a bounded, dependency-free static inspector for MTA `meta.xml` text.

It follows the documented MTA resource metadata concepts for tags such as `info`, `script`, `file`, `map`, `include`, `config`, `export`, `html`, `settings`, `min_mta_version` and ACL requests.

Reference: https://wiki.multitheftauto.com/wiki/Meta.xml

## API

Authenticated users with `product.create` capability can submit plain `meta.xml` text to:

```text
POST /api/resources/inspect-meta
Content-Type: text/plain
```

The response is private/no-store and contains a best-effort structural inspection.

The endpoint is rate-limited separately from uploads and resource creation.

## Input boundary

The first slice:

- accepts at most 256 KiB of UTF-8 text;
- checks a declared Content-Length before reading the body when available;
- rejects DTD and ENTITY declarations;
- does not resolve external entities;
- strips comments and CDATA before static tag extraction;
- does not execute Lua, JavaScript, XML instructions or resource settings;
- does not fetch URLs;
- does not access the filesystem;
- does not unpack archives.

This is deliberately **not** a general-purpose XML parser. It extracts only a small documented MTA metadata surface.

## Extracted facts

The inspection can report:

- resource `info` attributes;
- client/server/shared scripts;
- whether script type was explicitly declared;
- client `cache=false` counts;
- `validate=false` counts;
- files and maps;
- included resource dependencies;
- configs;
- exported functions and HTTP-enabled export count;
- HTML entries;
- settings count;
- minimum MTA client/server/both versions;
- requested ACL rights.

A script with no `type` is summarized as server-side because MTA documents server as the default. The result preserves `typeDeclared=false` so the UI can distinguish a default from an explicit declaration.

## Non-security semantics

Every API response carries:

```json
{
  "securityVerdict": null
}
```

The inspector is not:

- a malware scan;
- a cryptographic verification;
- an archive-integrity check;
- a Lua static analyzer;
- a guarantee that referenced files exist;
- a guarantee that MTA will accept the resource.

Structural errors and warnings are inspection hints only.

## Next step

A later RESOURCE-003 can connect this inspector to an accepted ZIP-only archive extraction path, then compare `meta.xml` references with actual archive entries. RAR/7z extraction should not be added until an explicit, sandboxed extraction dependency and resource limits are accepted.
