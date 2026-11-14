import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const exclusive = [
  "site/src/features/resources/server/resource-requirements-screen.tsx",
  "site/src/components/collection-releases-screen.tsx",
  "site/src/features/resources/server/build-package-screen.tsx",
  "site/src/components/library-release-history-screen.tsx",
] as const;

it("locks residual requirements/release filter submit CTAs to size=touch", () => {
  for (const path of exclusive) {
    const source = read(path);
    expect(source, path).toMatch(/type="submit"[^>]*size="touch"|size="touch"[^>]*type="submit"/u);
    expect(source, path).not.toContain("min-h-10");
    expect(source, path).not.toContain('size="sm"');
  }
});
