# Resource dependency resolution

RESOURCE-003 resolves the direct dependency slugs already stored in `product.compatibility.dependencies`.

It does not add a graph database or a new persistence model.

## Resolution rule

For a resource detail page, NEXUS:

1. normalizes and de-duplicates declared slugs;
2. caps the direct dependency set at 25, matching product validation;
3. runs one PostgreSQL query for those slugs;
4. resolves only resources that are both `published` and free;
5. preserves the author's declared order in the UI.

Draft, archived, suspended, missing or legacy paid products are not exposed as resolved dependency targets.

## States

Each declared dependency is shown as one of:

- **available** — a public free NEXUS resource with that slug exists;
- **unresolved** — no eligible public catalogue target was found;
- **self reference** — the resource declares its own slug.

“Available” means catalogue presence only. It does not prove version compatibility, correct installation order, runtime compatibility or trust.

## Product detail performance

Builds, reviews and direct dependency resolution are loaded in parallel through `Promise.all`.

Dependency resolution is secondary. If it fails, the resource page still renders and shows the author-declared slugs with an explicit “Catalogue resolution temporarily unavailable” note.

## Next step

A later graph slice can derive reverse dependencies and transitive relationships from these same declared slugs. That should remain PostgreSQL-backed until real scale measurements justify another datastore.
