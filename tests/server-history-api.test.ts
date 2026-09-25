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
      'coverage: "stored_confirmed_observations"',
    );
    expect(service).toContain('collectionMode: "collector_required"');
    expect(service).toContain("absenceMeansOffline: false");
    expect(service).not.toContain("mtaMasterDirectoryService");
    expect(service).not.toContain("serverObservationRepository.record");
  });

  it("keeps the GET history surface read-only", () => {
    const route = read(
      "apps/web/src/app/api/servers/[id]/history/route.ts",
    );
    const service = read(
      "apps/web/src/lib/services/server-history-service.ts",
    );

    expect(route).toContain("serverHistoryService.getHistory");
    expect(service).not.toContain(".record(");
    expect(service).not.toContain("getDirectory()");
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
