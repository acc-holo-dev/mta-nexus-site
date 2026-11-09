import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const exclusive = [
  "apps/web/src/components/resource-requirements-screen.tsx",
  "apps/web/src/components/collection-releases-screen.tsx",
  "apps/web/src/components/build-package-screen.tsx",
  "apps/web/src/components/library-release-history-screen.tsx",
] as const;

it("locks residual requirements/release filter submit CTAs to size=touch", () => {
  for (const path of exclusive) {
    const source = read(path);
    expect(source, path).toMatch(/type="submit"[^>]*size="touch"|size="touch"[^>]*type="submit"/u);
    expect(source, path).not.toContain("min-h-10");
    expect(source, path).not.toContain('size="sm"');
  }
});
