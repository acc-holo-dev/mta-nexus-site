import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Waves 99–100: workspace/admin commerce document titles use generateMetadata + locale copy. */
function collectPages(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name === "page.tsx") out.push(path);
    }
  };
  walk(root);
  return out;
}

describe("workspace document title honesty surface", () => {
  it("keeps waved workspace/admin trees off static English metadata titles", () => {
    const roots = [
      "site/src/app/workspace/library",
      "site/src/app/workspace/resources",
      "site/src/app/workspace/subscriptions",
      "site/src/app/workspace/purchases",
      "site/src/app/workspace/acquisitions",
      "site/src/app/workspace/licenses",
      "site/src/app/workspace/cart",
      "site/src/app/workspace/finance",
      "site/src/app/workspace/sales",
      "site/src/app/admin/commerce",
      "site/src/app/admin/licenses",
      "site/src/app/admin/resources",
      "site/src/app/admin/storage",
      "site/src/app/auth",
      "site/src/app/security",
      "site/src/app/market",
      "site/src/app/servers",
      "site/src/app/subscriptions",
      "site/src/app/community/new",
    ].map((p) => resolve(process.cwd(), p));

    const pages = roots.flatMap(collectPages);
    expect(pages.length).toBeGreaterThan(60);

    const staticEnglishTitle = /export const metadata(?:: Metadata)? = \{[\s\S]*?title:\s*"[^"]+"/;
    const offenders = pages.filter((path) => staticEnglishTitle.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);

    const withGenerate = pages.filter((path) =>
      readFileSync(path, "utf8").includes("generateMetadata"),
    );
    expect(withGenerate.length).toBeGreaterThan(60);
  });
});
