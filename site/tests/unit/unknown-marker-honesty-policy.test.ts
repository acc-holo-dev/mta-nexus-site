import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

let repoRoot = import.meta.dirname;
while (!existsSync(path.join(repoRoot, "pnpm-workspace.yaml"))) repoRoot = path.dirname(repoRoot);
const webSrcRoot = path.join(repoRoot, "site/src");

/** Only dictionary definitions may keep a quoted em-dash unknown marker. */
const ALLOWED_UNKNOWN_MARKER_DEFS = [
  "site/src/lib/i18n/en/errors.ts",
  "site/src/lib/i18n/ru/errors.ts",
] as const;

const QUOTED_EM_DASH = /["']—["']/u;

function listAppSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listAppSourceFiles(full));
      continue;
    }
    if (!/\.(tsx?|jsx?)$/u.test(entry)) continue;
    if (/\.test\.(tsx?|jsx?)$/u.test(entry)) continue;
    if (/\.honesty-surface\.test\.(tsx?|jsx?)$/u.test(entry)) continue;
    out.push(full);
  }
  return out;
}

describe("unknown marker honesty policy", () => {
  it("forbids quoted em-dash under site/src outside errors.unknownMarker defs", () => {
    const allowed = new Set<string>(ALLOWED_UNKNOWN_MARKER_DEFS);
    const offenders = listAppSourceFiles(webSrcRoot)
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"))
      .filter((relative) => !allowed.has(relative))
      .filter((relative) =>
        QUOTED_EM_DASH.test(readFileSync(path.join(repoRoot, relative), "utf8")),
      )
      .sort();
    expect(offenders).toEqual([]);
  });

  it("keeps unknownMarker definitions in en/ru errors dictionaries", () => {
    for (const relative of ALLOWED_UNKNOWN_MARKER_DEFS) {
      const source = readFileSync(path.join(repoRoot, relative), "utf8");
      expect(source, relative).toMatch(/unknownMarker:\s*"—"/u);
    }
  });
});
