import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Wave 99: workspace library/resources/subscriptions document titles use generateMetadata + locale copy. */
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
  it("keeps library/resources/subscriptions pages off static English metadata titles", () => {
    const roots = [
      "site/src/app/workspace/library",
      "site/src/app/workspace/resources",
      "site/src/app/workspace/subscriptions",
    ].map((p) => resolve(process.cwd(), p));

    const pages = roots.flatMap(collectPages);
    expect(pages.length).toBeGreaterThan(40);

    const staticEnglishTitle = /export const metadata(?:: Metadata)? = \{[\s\S]*?title:\s*"[^"]+"/;
    const offenders = pages.filter((path) => staticEnglishTitle.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);

    const withGenerate = pages.filter((path) =>
      readFileSync(path, "utf8").includes("generateMetadata"),
    );
    expect(withGenerate.length).toBeGreaterThan(45);
  });
});
