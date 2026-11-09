import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const commerceAlertPages = [
  "apps/web/src/app/workspace/acquisitions/receipts/page.tsx",
  "apps/web/src/app/workspace/purchases/[id]/terms/page.tsx",
  "apps/web/src/app/admin/commerce/reconciliation/[id]/terms/page.tsx",
] as const;

it("locks commerce terms and receipt invalid filters to ErrorState without plain alert paragraphs", () => {
  for (const path of commerceAlertPages) {
    const source = read(path);
    expect(source, path).toContain("ErrorState");
    expect(source, path).toContain("overflow-x-clip");
    expect(source, path).toContain("min-w-0");
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain('role="alert"');
    expect(source, path).not.toContain('<p role="alert"');
  }
});

it("keeps invalid-filter recovery linked through ErrorState action slots", () => {
  const receipts = read("apps/web/src/app/workspace/acquisitions/receipts/page.tsx");
  expect(receipts).toContain("title={copy.invalid}");
  expect(receipts).toContain('href="/workspace/acquisitions/receipts"');

  const buyer = read("apps/web/src/app/workspace/purchases/[id]/terms/page.tsx");
  expect(buyer).toContain("title={c.invalid}");
  expect(buyer).toContain('href="/workspace/purchases"');

  const admin = read("apps/web/src/app/admin/commerce/reconciliation/[id]/terms/page.tsx");
  expect(admin).toContain("title={c.invalid}");
  expect(admin).toContain('href="/admin/commerce/reconciliation"');
});
