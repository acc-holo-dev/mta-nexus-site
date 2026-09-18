import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("server management surface", () => {
  it("lets only authenticated owners manage a listing without agent setup", () => {
    const page = readFileSync(
      path.resolve(process.cwd(), "apps/web/src/app/workspace/servers/[id]/page.tsx"),
      "utf8"
    );

    expect(page).toContain('server.ownerId !== user.id && user.role !== "admin"');
    expect(page).toContain("ServerDetailsForm");
    expect(page).toContain("official MTA master-list");
    expect(page).not.toContain("InstallationKeyRotation");
    expect(page).not.toContain("heartbeat");
  });
});
