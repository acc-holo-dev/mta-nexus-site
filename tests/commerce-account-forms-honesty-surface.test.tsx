import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const formComponents = [
  "apps/web/src/components/account-controls.tsx",
  "apps/web/src/components/subscription-controls.tsx",
  "apps/web/src/components/subscription-fee-estimator.tsx",
  "apps/web/src/components/commercial-fee-calculator.tsx",
  "apps/web/src/components/commercial-plan-form.tsx",
  "apps/web/src/components/plan-review-form.tsx",
  "apps/web/src/components/order-case-forms.tsx",
  "apps/web/src/components/order-cancellation-form.tsx",
  "apps/web/src/components/resource-cart-controls.tsx",
  "apps/web/src/components/resource-download-button.tsx",
  "apps/web/src/components/license-control-panel.tsx",
  "apps/web/src/components/license-runtime-probe.tsx",
  "apps/web/src/components/organization-ownership-transfer.tsx",
  "apps/web/src/components/register-server-form.tsx",
  "apps/web/src/components/storage-maintenance-controls.tsx",
] as const;

it("locks commerce and account form failures to ErrorState with touch CTAs", () => {
  for (const path of formComponents) {
    const source = read(path);
    expect(source, path).toContain("ErrorState");
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain('role="alert"');
  }
});

it("keeps additive formErrorHint / errorHint copy for commerce and account honesty", () => {
  expect(read("apps/web/src/lib/i18n/en/chrome.ts")).toContain("errorHint:");
  expect(read("apps/web/src/lib/i18n/ru/chrome.ts")).toContain("errorHint:");
  expect(read("apps/web/src/lib/subscriptions-i18n.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/commercial-i18n.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/order-case-i18n.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/plan-reviews-i18n.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/resource-commerce-i18n.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/license-control-i18n.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/organization-governance-copy.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/storage-maintenance-i18n.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/i18n/en/publishing.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/i18n/ru/publishing.ts")).toContain("formErrorHint:");
  expect(read("apps/web/src/lib/i18n/en/product.ts")).toContain("downloadErrorHint:");
  expect(read("apps/web/src/lib/i18n/ru/product.ts")).toContain("downloadErrorHint:");
});
