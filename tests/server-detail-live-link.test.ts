import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("editorial server detail live linkage", () => {
  it("keeps live observations separate and matches by normalized public endpoint", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/servers/[slug]/page.tsx"),
      "utf8"
    );

    expect(page).toContain("matchesMtaEndpoint");
    expect(page).toContain("mtaMasterDirectoryService.getDirectory()");
    expect(page).toContain("No current observation in the official MTA directory.");
    expect(page).toContain('<span>{observedServer ? (isOnline ? "ONLINE" : "OFFLINE") : "UNKNOWN"}</span>');
    expect(page).not.toContain("item.address === server.ipAddress");
    expect(page).not.toContain("heartbeat");
  });
});
