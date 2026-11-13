import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const commerceAlertPages = [
  "site/src/app/workspace/acquisitions/receipts/page.tsx",
  "site/src/app/workspace/purchases/[id]/terms/page.tsx",
  "site/src/app/admin/commerce/reconciliation/[id]/terms/page.tsx",
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
  const receipts = read("site/src/app/workspace/acquisitions/receipts/page.tsx");
  expect(receipts).toContain("title={copy.invalid}");
  expect(receipts).toContain('href="/workspace/acquisitions/receipts"');

  const buyer = read("site/src/app/workspace/purchases/[id]/terms/page.tsx");
  expect(buyer).toContain("title={c.invalid}");
  expect(buyer).toContain('href="/workspace/purchases"');

  const admin = read("site/src/app/admin/commerce/reconciliation/[id]/terms/page.tsx");
  expect(admin).toContain("title={c.invalid}");
  expect(admin).toContain('href="/admin/commerce/reconciliation"');
});
