import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/community/components/article-card.tsx"),
  "utf8",
);

/** Honesty lock: article cards stretch in CSS grids and pin the stats/CTA strip to a shared baseline. */
it("locks article card grid stretch alignment with h-full and mt-auto footer", () => {
  expect(source).toMatch(/className="group flex h-full flex-col /u);
  expect(source).toContain(
    'className="mt-auto flex items-center justify-between border-t border-base pt-2.5 font-caption"',
  );
  expect(source).toContain("typeFlex1ColGap2P35");
});
