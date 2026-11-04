import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const exclusive = [
  "apps/web/src/components/mta-meta-inspector-panel.tsx",
  "apps/web/src/components/resource-variants-form.tsx",
  "apps/web/src/components/new-resource-form.tsx",
] as const;

it("locks resource author touch/empty surfaces to size=touch and EmptyState honesty", () => {
  for (const path of exclusive) {
    const source = read(path);
    expect(source, path).toContain('size="touch"');
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain("min-h-8");
  }

  const variants = read("apps/web/src/components/resource-variants-form.tsx");
  expect(variants).toContain("EmptyState");
  expect(variants).toContain("copy.noCandidatesHint");
  expect(variants).not.toContain('size="sm"');
  expect(variants.match(/size="touch"/gu)?.length ?? 0).toBeGreaterThanOrEqual(3);

  const meta = read("apps/web/src/components/mta-meta-inspector-panel.tsx");
  expect(meta).toMatch(
    /onApplyMinimumVersion[\s\S]{0,120}?size="touch"|size="touch"[\s\S]{0,120}?onApplyMinimumVersion/u,
  );

  const create = read("apps/web/src/components/new-resource-form.tsx");
  expect(create).toMatch(
    /onClick=\{startNewSubmission\}[\s\S]{0,80}?size="touch"|size="touch"[\s\S]{0,80}?onClick=\{startNewSubmission\}/u,
  );
});
