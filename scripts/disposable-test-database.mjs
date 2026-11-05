import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Fail closed before migrations or shared database suites. No URL is logged. */
export function assertDisposableTestDatabase(env = process.env) {
  if (env.NEXUS_DISPOSABLE_DATABASE !== "1") {
    throw new Error("Set NEXUS_DISPOSABLE_DATABASE=1 for an explicitly disposable test database.");
  }
  let target;
  try {
    target = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("A valid disposable PostgreSQL DATABASE_URL is required.");
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(target.hostname) ||
    !target.username ||
    target.search ||
    target.hash ||
    !/^\/(?:[a-z0-9][a-z0-9_]{0,52}_(?:test|verify)|nexus_test_[a-f0-9]{32}|nexus_focus_[0-9]{1,12}_[0-9]{1,5})$/u.test(
      target.pathname,
    )
  ) {
    throw new Error(
      "Database verification requires a named local or Compose disposable test database.",
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assertDisposableTestDatabase();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
