import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("server management surface", () => {
  it("lets only authorized managers edit a listing without agent setup", () => {
    const page = readFileSync(
      path.resolve(
        process.cwd(),
        "apps/web/src/app/workspace/servers/[id]/page.tsx",
      ),
      "utf8",
    );

    expect(page).toContain(
      "serverService.canManageServer(server, user)",
    );
    expect(page).toContain("ServerDetailsForm");
    expect(page).toContain("copy.ownerManaged");
    expect(page).toContain("copy.ownerManagedDescription");
    expect(page).not.toContain("InstallationKeyRotation");
    expect(page).not.toContain("heartbeat");
  });
});
