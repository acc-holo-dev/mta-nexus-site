import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("server management surface", () => {
  it("lets only authenticated owners manage and rotate an installation key", () => {
    const page = readFileSync(
      path.resolve(process.cwd(), "apps/web/src/app/workspace/servers/[id]/page.tsx"),
      "utf8"
    );
    const component = readFileSync(
      path.resolve(process.cwd(), "apps/web/src/components/installation-key-rotation.tsx"),
      "utf8"
    );

    expect(page).toContain('server.ownerId !== user.id && user.role !== "admin"');
    expect(page).toContain("InstallationKeyRotation");
    expect(component).toContain('method: "POST"');
    expect(component).toContain('moduleVersion: "0.1.0"');
  });
});
