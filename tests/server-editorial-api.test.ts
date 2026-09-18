import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("editorial server API", () => {
  it("returns profiles with an explicit official live-observation layer", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/servers/route.ts"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/server-service.ts"),
      "utf8"
    );

    expect(route).toContain("serverService.listServers(limit)");
    expect(route).toContain("Math.min(Math.max(Math.floor(requestedLimit), 1), 100)");
    expect(route).toContain("mtaMasterDirectoryService.getDirectory()");
    expect(route).toContain("matchesMtaEndpoint(server, observation)");
    expect(route).toContain("liveObservation: liveObservation ?? null");
    expect(route).toContain('liveStatus: liveObservation');
    expect(service).toContain('status: "active"');
  });
});
