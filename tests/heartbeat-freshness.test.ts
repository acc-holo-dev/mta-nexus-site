import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("heartbeat freshness", () => {
  it("does not use profile update time to determine live server status", () => {
    const publicPage = readFileSync(path.resolve(process.cwd(), "apps/web/src/app/servers/[slug]/page.tsx"), "utf8");
    const workspace = readFileSync(path.resolve(process.cwd(), "apps/web/src/app/workspace/page.tsx"), "utf8");
    const telemetry = readFileSync(path.resolve(process.cwd(), "packages/db/src/repositories/telemetry.ts"), "utf8");

    expect(publicPage).toContain("server.lastHeartbeatAt");
    expect(workspace).toContain("server.lastHeartbeatAt");
    expect(telemetry).toContain("lastHeartbeatAt: recordedAt");
    expect(publicPage).not.toContain("new Date(server.updatedAt).getTime()");
  });
});
