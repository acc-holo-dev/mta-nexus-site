# Reverse resource dependencies

RESOURCE-004 derives a bounded **Used by published resources** view from the dependency slugs already stored in PostgreSQL.

No graph database or new table is introduced.

## Query

For a resource slug, the repository uses PostgreSQL JSONB containment against `compatibility.dependencies` and returns at most 51 rows.

The query includes only resources that are:

- `published`;
- free;
- not the resource itself.

The 51st row is a sentinel used to detect when the beta UI cap of 50 visible direct dependents has been reached.

## UI semantics

The resource page can show up to 50 public resources that directly declare the current resource slug as a dependency.

This means only:

> the published resource declares this slug in its direct dependency metadata.

It does not prove:

- runtime compatibility;
- installation success;
- dependency version compatibility;
- transitive compatibility;
- that the declaration came from an inspected `meta.xml`.

## Failure behavior

Reverse dependency lookup is a secondary read. It participates in the same product-detail `Promise.all` group as builds, reviews and forward dependency resolution, but catches its own failure so the resource page remains available.

## Scaling boundary

The current JSONB query intentionally avoids a schema migration for closed-beta scale. If measured query cost becomes material, add an evidence-driven GIN index or normalized dependency edge table before considering a separate graph datastore.
