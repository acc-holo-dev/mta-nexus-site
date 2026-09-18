import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("workspace live telemetry source", () => {
  it("uses the official MTA directory and keeps missing observations neutral", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/workspace/page.tsx"),
      "utf8"
    );

    expect(page).toContain("mtaMasterDirectoryService.getDirectory()");
    expect(page).toContain("matchesMtaEndpoint(server, observation)");
    expect(page).toContain('status={isOnline ? "online" : isOffline ? "offline" : "unknown"}');
    expect(page).toContain("missing observations stay unknown");
    expect(page).not.toContain("lastHeartbeatAt");
    expect(page).not.toContain("server.currentPlayers");
  });
});
