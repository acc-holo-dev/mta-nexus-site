/**
 * HTTP → repository boundary (OPS-01 / ARC02).
 *
 * Composite mutating business operations belong in `apps/web/src/lib/services`.
 * HTTP handlers may call `@nexus/db` only when listed below:
 * - `HTTP_DB_ALLOWED_READ_HEALTH`: simple read / health checks (no empty service wrappers).
 * - `HTTP_DB_SERVICE_REQUIRED`: known mutation (or complex acquisition) paths that still
 *   import repositories today. Do not expand this list for new features — move work into a
 *   named service command instead. Touching a listed mutation should migrate it when practical.
 *
 * Paths are matched against dependency-cruiser `from.path` (repo-relative source paths).
 */
const HTTP_DB_ALLOWED_READ_HEALTH = Object.freeze([
  "^apps/web/src/app/api/health/",
  "^apps/web/src/app/api/notifications/route\\.ts$",
  "^apps/web/src/app/api/finance/",
  "^apps/web/src/app/api/support/[^/]+/activity/",
  "^apps/web/src/app/api/workspace/server-organizations/",
  "^apps/web/src/app/api/admin/commerce/reconciliation/",
  "^apps/web/src/app/api/licenses/check/",
  "^apps/web/src/app/api/licenses/check-release/",
]);

const HTTP_DB_SERVICE_REQUIRED = Object.freeze([
  "^apps/web/src/app/api/admin/actions/",
  "^apps/web/src/app/api/admin/builds/",
  "^apps/web/src/app/api/auth/context/",
  "^apps/web/src/app/api/content/route\\.ts$",
  "^apps/web/src/app/api/follow/",
  "^apps/web/src/app/api/notifications/mark-read/",
  "^apps/web/src/app/api/notifications/preferences/",
  "^apps/web/src/app/api/notifications/push/",
  "^apps/web/src/app/api/products/[^/]+/download/",
  "^apps/web/src/app/api/reports/",
  "^apps/web/src/app/api/support/route\\.ts$",
  "^apps/web/src/app/api/support/\\[id\\]/",
  "^apps/web/src/app/api/verification/",
  "^apps/web/src/app/api/workspace/content/route\\.ts$",
]);

module.exports = {
  HTTP_DB_ALLOWED_READ_HEALTH,
  HTTP_DB_SERVICE_REQUIRED,
  HTTP_DB_EXCEPTION_PATH: [...HTTP_DB_ALLOWED_READ_HEALTH, ...HTTP_DB_SERVICE_REQUIRED].join("|"),
};
