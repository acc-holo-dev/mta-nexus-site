/** Database-only configuration for web, migration and isolated worker processes. */
export function readDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env.DATABASE_URL ??
    (env.NODE_ENV === "production" ? "" : "postgres://nexus:nexus_secret@127.0.0.1:5432/mta_nexus");
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) throw new Error();
  } catch {
    // Never include the connection string: it may contain credentials.
    throw new Error("A valid PostgreSQL DATABASE_URL is required");
  }
  return value;
}
