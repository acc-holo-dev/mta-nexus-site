import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("server registration handoff", () => {
  it("creates a key for the current agent and opens server management", () => {
    const page = readFileSync(
      path.resolve(process.cwd(), "apps/web/src/app/workspace/servers/new/page.tsx"),
      "utf8"
    );

    expect(page).toContain('moduleVersion: "0.1.0"');
    expect(page).toContain('"/workspace/servers/" + installation.serverId');
    expect(page).toContain("Open server management");
  });
});
