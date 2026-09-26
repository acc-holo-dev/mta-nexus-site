import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("editorial server detail live linkage", () => {
  it("keeps live observations separate and matches by normalized public endpoint", () => {
    const page = read(
      "apps/web/src/app/servers/[slug]/page.tsx",
    );

    expect(page).toContain("matchesMtaEndpoint");
    expect(page).toContain(
      "mtaMasterDirectoryService.getDirectory()",
    );
    expect(page).toContain("copy.noObservation");
    expect(page).toContain("serverCopy.online");
    expect(page).toContain("serverCopy.offline");
    expect(page).toContain("serverCopy.unknown");
    expect(page).not.toContain(
      "item.address === server.ipAddress",
    );
    expect(page).not.toContain("heartbeat");
  });
});
