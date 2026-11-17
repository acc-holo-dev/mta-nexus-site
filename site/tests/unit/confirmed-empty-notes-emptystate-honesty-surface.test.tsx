import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surfaces = [
  {
    path: "site/src/features/commerce/server/order-case-page.tsx",
    title: "copy.noPayments",
    description: "copy.noPaymentsHint",
    soft: /<p className="text-sm text-secondary">\{copy\.noPayments\}<\/p>/u,
  },
  {
    path: "site/src/features/resources/components/resource-review-controls.tsx",
    title: "copy.noLatestReview",
    description: "copy.noLatestReviewHint",
    soft: /<p>\{copy\.noLatestReview\}<\/p>/u,
  },
  {
    path: "site/src/features/servers/components/server-review-panel.tsx",
    title: "copy.noLatestReview",
    description: "copy.noLatestReviewHint",
    soft: /<p>\{copy\.noLatestReview\}<\/p>/u,
  },
  {
    path: "site/src/features/organizations/components/organization-ownership-transfer.tsx",
    title: "copy.noSelection",
    description: "copy.noSelectionHint",
    soft: /<p className="text-sm text-muted">\{copy\.noSelection\}<\/p>/u,
  },
] as const;

it("locks remaining confirmed-empty notes to EmptyState with honesty hints", () => {
  for (const surface of surfaces) {
    const source = read(surface.path);
    expect(source, surface.path).toContain("EmptyState");
    expect(source, surface.path).toContain(surface.title);
    expect(source, surface.path).toContain(surface.description);
    expect(source, surface.path).not.toMatch(surface.soft);
  }
  expect(read("site/src/features/commerce/order-case-i18n.ts")).toContain("noPaymentsHint:");
  expect(read("site/src/features/resources/resource-review-i18n.ts")).toContain(
    "noLatestReviewHint:",
  );
  expect(read("site/src/features/servers/server-review-i18n.ts")).toContain("noLatestReviewHint:");
  expect(read("site/src/features/organizations/organization-governance-copy.ts")).toContain(
    "noSelectionHint:",
  );
});
