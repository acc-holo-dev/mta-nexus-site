import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server observation history API", () => {
  it("offers bounded windows and refuses to describe missing listings as downtime", () => {
    const route = read(
      "apps/web/src/app/api/servers/[id]/history/route.ts",
    );
    const service = read(
      "apps/web/src/lib/services/server-history-service.ts",
    );

    expect(route).toContain('z.enum(["24h", "7d", "30d"])');
    expect(route).toContain('"Cache-Control": "no-store"');
    expect(service).toContain(
      'coverage: "demand_driven_confirmed_listings"',
    );
    expect(service).toContain("absenceMeansOffline: false");
    expect(service).toContain('status: "not_listed"');
    expect(service).not.toContain('status: "offline"');
  });

  it("deduplicates demand-driven master snapshots by fetchedAt", () => {
    const service = read(
      "apps/web/src/lib/services/server-history-service.ts",
    );
    const repository = read(
      "packages/db/src/repositories/server-observations.ts",
    );

    expect(service).toContain("sourceSequence: directory.fetchedAt");
    expect(service).toContain("observedAt: new Date(directory.fetchedAt)");
    expect(repository).toContain("onConflictDoNothing()");
  });

  it("keeps master-list metadata from overwriting editorial profile fields", () => {
    const repository = read(
      "packages/db/src/repositories/server-observations.ts",
    );
    const updateBlock = repository.slice(
      repository.indexOf(".update(servers)"),
      repository.indexOf(".where(eq(servers.id"),
    );

    expect(updateBlock).toContain("currentPlayers");
    expect(updateBlock).toContain("lastObservedAt");
    expect(updateBlock).not.toContain("name:");
    expect(updateBlock).not.toContain("gameMode:");
    expect(updateBlock).not.toContain("mapName:");
  });
});
