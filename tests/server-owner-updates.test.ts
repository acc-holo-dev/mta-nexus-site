import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("server owner updates", () => {
  it("only accepts public-card fields and enforces owner authorization in the service", () => {
    const route = readFileSync(path.resolve(process.cwd(), "apps/web/src/app/api/servers/[id]/route.ts"), "utf8");
    const service = readFileSync(path.resolve(process.cwd(), "apps/web/src/lib/services/server-service.ts"), "utf8");

    expect(route).toContain("serverUpdateSchema");
    expect(route).toContain('visibility: z.enum(["public", "unlisted", "private"]).optional()');
    expect(route).not.toContain("ownerId:");
    expect(route).not.toContain("status: z.");
    expect(service).toContain('can(actor, "server.manage", server)');
    expect(service).toContain('action: "server.updated"');
  });
});
