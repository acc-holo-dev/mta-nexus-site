import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

let repoRoot = import.meta.dirname;
while (!existsSync(path.join(repoRoot, "pnpm-workspace.yaml"))) repoRoot = path.dirname(repoRoot);
const webSrcRoot = path.join(repoRoot, "site/src");

/** Canonical homes for live `role="alert"` chrome in `@nexus/ui`. */
const ALLOWED_ALERT_SOURCES = [
  "site/packages/ui/src/input.tsx",
  "site/packages/ui/src/error-state.tsx",
] as const;

/** Literal alert role bindings apps must not invent outside the allowed UI chrome. */
const RAW_ROLE_ALERT = /role\s*=\s*(?:"alert"|'alert'|\{(?:"alert"|'alert'|`alert`)\})/u;

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
    out.push(full);
  }
  return out;
}

describe("ui field alert honesty policy", () => {
  it("forbids raw role=alert under site/src production sources", () => {
    const offenders = listAppSourceFiles(webSrcRoot)
      .filter((file) => RAW_ROLE_ALERT.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"))
      .sort();
    expect(offenders).toEqual([]);
  });

  it("keeps field and surface alert roles only in allowed @nexus/ui chrome", () => {
    for (const relative of ALLOWED_ALERT_SOURCES) {
      const source = readFileSync(path.join(repoRoot, relative), "utf8");
      expect(source, relative).toMatch(RAW_ROLE_ALERT);
    }
  });
});
