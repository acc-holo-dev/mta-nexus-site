# Resource safety operations

**Статус:** living · ops module (D4 extract).  
**Канон:** якорь [`## 5. Resource safety operations`](../OPERATIONS.md#5-resource-safety-operations) в OPERATIONS.

## 5. Resource safety operations

Admin storage discovery, namespace inspection, and object cleanup require `X-Nexus-Actor-Id` for the administrator who opened the screen. The UI checks the actor in responses and blocks another cleanup when a result is unknown until the page is refreshed. A request or test does not itself establish that a live storage cleanup is authorized.

The build safety rule is enforced in repository queries and at the database layer. Migration `0020_build_safety_invariants.sql` deliberately fails closed:

- unsafe legacy `published` builds are retired;
- invalid legacy `clean` verdicts without provenance are reset to `not_scanned`;
- public products without a remaining safe build are returned to `draft`;
- `currentVersion` is realigned to the newest safe published build where one exists.

Review these data-changing effects on an isolated restored backup before applying the migration to any existing production dataset.

