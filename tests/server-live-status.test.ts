import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const serverPage = readFileSync(
  path.resolve(process.cwd(), "apps/web/src/app/servers/[slug]/page.tsx"),
  "utf8"
);

describe("public server live status", () => {
  it("does not present stale telemetry as an online server", () => {
    expect(serverPage).toContain("HEARTBEAT_FRESHNESS_MS");
    expect(serverPage).toContain('server.status === "active"');
    expect(serverPage).toContain("new Date(server.updatedAt).getTime()");
    expect(serverPage).toContain('{isOnline ? "ONLINE" : "OFFLINE"}');
  });

  it("does not label the closed-beta heartbeat agent as entitlement enforcement", () => {
    expect(serverPage).toContain("NEXUS heartbeat agent");
    expect(serverPage).not.toContain("anti-tamper entitlement active");
  });
});
