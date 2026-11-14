import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const exclusive = [
  "site/src/components/seller-sales-report.tsx",
  "site/src/features/resources/components/resource-review-controls.tsx",
  "site/src/components/support-center.tsx",
  "site/src/components/order-case-page.tsx",
  "site/src/features/servers/components/mta-master-server-directory.tsx",
] as const;

it("locks high-traffic button stragglers to size=touch / min-h-11 without min-h-10", () => {
  for (const path of exclusive) {
    const source = read(path);
    expect(source, path).toContain('size="touch"');
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain("min-h-10");
  }
});

it("locks resource-review primary submit CTAs to size=touch", () => {
  const source = read("site/src/features/resources/components/resource-review-controls.tsx");
  const touchSubmits = source.match(/<Button\s+type="submit"\s+size="touch"/gu) ?? [];
  expect(touchSubmits.length).toBeGreaterThanOrEqual(3);
});

it("locks order-case filter selects to min-h-11 field chrome", () => {
  const source = read("site/src/components/order-case-page.tsx");
  expect(source).toContain("min-h-11 rounded-lg border border-base bg-surface p-2 text-sm");
  expect(source).toContain('size="touch"');
});

it("locks seller-sales apply and support create-case submit to size=touch", () => {
  expect(read("site/src/components/seller-sales-report.tsx")).toMatch(
    /type="submit"[^>]*size="touch"|size="touch"[^>]*type="submit"/u,
  );
  expect(read("site/src/components/support-center.tsx")).toMatch(
    /variant="primary"[\s\S]{0,40}?size="touch"|size="touch"[\s\S]{0,80}?variant="primary"/u,
  );
  expect(read("site/src/features/servers/components/mta-master-server-directory.tsx")).toMatch(
    /onClick=\{resetFilters\}[\s\S]{0,40}?size="touch"|size="touch"[\s\S]{0,80}?onClick=\{resetFilters\}/u,
  );
});

it("locks MTA directory empty chrome to EmptyState without size=sm stragglers", () => {
  const source = read("site/src/features/servers/components/mta-master-server-directory.tsx");
  expect(source).toContain("EmptyState");
  expect(source).toContain("noMatchDescription");
  expect(source).toContain("noneDescription");
  expect(source).not.toContain('size="sm"');
  expect(source).not.toContain("min-h-10");
});
