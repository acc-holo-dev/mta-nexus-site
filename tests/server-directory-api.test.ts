import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("official MTA directory API", () => {
  it("keeps live master-list data in a dedicated, bounded endpoint", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/servers/directory/route.ts"),
      "utf8"
    );

    expect(route).toContain("mtaMasterDirectoryService.getDirectory()");
    expect(route).toContain("directoryQuerySchema");
    expect(route).toContain("max(100)");
    expect(route).toContain("matchingServers.slice(offset, offset + limit)");
    expect(route).toContain('status: 503');
    expect(route).toContain("stale-while-revalidate=120");
  });
});
