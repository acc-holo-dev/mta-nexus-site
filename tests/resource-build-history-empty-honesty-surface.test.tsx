import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks resource build history empty chrome to EmptyState", () => {
  const source = read("apps/web/src/components/resource-build-screen.tsx");
  expect(source).toContain("EmptyState");
  expect(source).toContain("copy.noHistory");
  expect(source).toContain("History");
  expect(source).not.toContain('<p className="text-secondary">{copy.noHistory}</p>');
});
