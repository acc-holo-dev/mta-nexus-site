import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public MTA directory surface", () => {
  it("loads only paginated live data instead of embedding the full master-list", () => {
    const component = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/mta-master-server-directory.tsx"),
      "utf8"
    );
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/servers/page.tsx"),
      "utf8"
    );

    expect(component).toContain('fetch("/api/servers/directory?" + params');
    expect(component).toContain("const PAGE_SIZE = 50");
    expect(component).toContain("Page {page + 1} of {totalPages}");
    expect(page).toContain("<MtaMasterServerDirectory />");
    expect(page).not.toContain("mtaMasterDirectoryService");
  });
});
