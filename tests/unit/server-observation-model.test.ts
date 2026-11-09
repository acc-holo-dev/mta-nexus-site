import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public MTA observation model", () => {
  it("contains no active server-installed agent schema", () => {
    const schema = read("packages/db/src/schema.ts");
    const domain = read("packages/domain/src/entities.ts");

    expect(schema).not.toContain("serverInstallations");
    expect(schema).not.toContain("serverHeartbeats");
    expect(schema).not.toContain("apiKeyHash");
    expect(domain).not.toContain("ServerInstallation");
    expect(domain).not.toContain("lastHeartbeatAt");
  });

  it("persists immutable sourced observations and permits unclaimed servers", () => {
    const schema = read("packages/db/src/schema.ts");
    const repository = read("packages/db/src/repositories/server-observations.ts");
    const migration = read("packages/db/migrations/0010_public_server_observations.sql");

    const compactSchema = schema.replace(/\s+/gu, "");
    expect(compactSchema).toContain('serverObservations=pgTable("server_observations"');
    expect(compactSchema).toContain('lastObservedAt:timestamp("last_observed_at"');
    expect(repository).toContain(".onConflictDoNothing({");
    expect(repository).toContain("serverObservations.sourceSequence,");
    expect(repository).toContain("getPeakPlayers");
    expect(migration).toContain('ALTER COLUMN "owner_id" DROP NOT NULL');
    expect(migration).toContain('DROP TABLE IF EXISTS "server_installations"');
  });

  it("models unavailable live values as unknown instead of zero", () => {
    const schema = read("packages/db/src/schema.ts");
    const migration = read("packages/db/migrations/0010_public_server_observations.sql");

    expect(schema).toContain('currentPlayers: integer("current_players")');
    expect(schema).not.toContain('currentPlayers: integer("current_players").notNull().default(0)');
    expect(migration).toContain('SET "current_players" = NULL, "max_players" = NULL');
  });
});
