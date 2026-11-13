import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const exclusive = [
  "site/src/components/server-connect-controls.tsx",
  "site/src/app/error.tsx",
] as const;

it("locks connect copy and root error CTAs to size=touch / min-h-11 without size=sm", () => {
  for (const path of exclusive) {
    const source = read(path);
    expect(source, path).toContain('size="touch"');
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain('size="sm"');
    expect(source, path).not.toContain("min-h-10");
  }
});

it("locks root error home link and both Buttons to touch chrome", () => {
  const source = read("site/src/app/error.tsx");
  expect(source.match(/size="touch"/gu)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(source).toContain("min-h-11 items-center");
});

it("locks server connect copy Button to size=touch with min-h-11 class", () => {
  const source = read("site/src/components/server-connect-controls.tsx");
  expect(source).toMatch(
    /size="touch"[\s\S]{0,240}?className="min-h-11 gap-1\.5"|className="min-h-11 gap-1\.5"[\s\S]{0,240}?size="touch"/u,
  );
});
