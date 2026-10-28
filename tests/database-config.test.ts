import { describe, expect, it } from "vitest";
import { readDatabaseUrl } from "../packages/db/src/database-config";

describe("isolated database configuration", () => {
  it("accepts a production worker with only a database URL", () => {
    const DATABASE_URL = "postgres://worker:private@postgres:5432/nexus";
    expect(readDatabaseUrl({ NODE_ENV: "production", DATABASE_URL })).toBe(DATABASE_URL);
  });
  it("keeps the local development default", () => {
    expect(readDatabaseUrl({})).toBe("postgres://nexus:nexus_secret@127.0.0.1:5432/mta_nexus");
  });
  it.each(["", "https://user:private@example.com/db", "postgres://", "private"])(
    "rejects invalid production URLs without exposing their contents",
    (DATABASE_URL) => {
      expect(() => readDatabaseUrl({ NODE_ENV: "production", DATABASE_URL })).toThrow(
        "A valid PostgreSQL DATABASE_URL is required",
      );
    },
  );
  it("never falls back to local credentials in production", () => {
    expect(() => readDatabaseUrl({ NODE_ENV: "production" })).toThrow();
  });
});
