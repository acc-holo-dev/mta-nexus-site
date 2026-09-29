import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

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

    expect(component).toMatch(
      /fetch\(\s*(?:`\/api\/servers\/directory\?\$\{params\}`|"\/api\/servers\/directory\?"\s*\+\s*params)\s*,/,
    );
    expect(component).toContain("const PAGE_SIZE = 50");
    expect(component).toContain("{copy.page} {page + 1} {copy.of} {totalPages}");
    expect(getDictionary("en").servers.page).not.toBe(getDictionary("ru").servers.page);
    expect(page).toContain("<MtaMasterServerDirectory locale={locale} />");
    expect(page).not.toContain("mtaMasterDirectoryService");
  });
});
