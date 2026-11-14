import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const formComponents = [
  "site/src/components/account-controls.tsx",
  "site/src/components/subscription-controls.tsx",
  "site/src/components/subscription-fee-estimator.tsx",
  "site/src/components/commercial-fee-calculator.tsx",
  "site/src/components/commercial-plan-form.tsx",
  "site/src/components/plan-review-form.tsx",
  "site/src/components/order-case-forms.tsx",
  "site/src/components/order-cancellation-form.tsx",
  "site/src/features/resources/components/resource-cart-controls.tsx",
  "site/src/features/resources/components/resource-download-button.tsx",
  "site/src/components/license-control-panel.tsx",
  "site/src/components/license-runtime-probe.tsx",
  "site/src/components/organization-ownership-transfer.tsx",
  "site/src/features/servers/components/register-server-form.tsx",
  "site/src/components/storage-maintenance-controls.tsx",
] as const;

it("locks commerce and account form failures to ErrorState with touch CTAs", () => {
  for (const path of formComponents) {
    const source = read(path);
    expect(source, path).toContain("ErrorState");
    expect(source, path).toMatch(/min-h-11|size="touch"/u);
    expect(source, path).not.toContain('role="alert"');
  }
});

it("locks register server native controls to fieldControlClass without h-10 chrome", () => {
  const source = read("site/src/features/servers/components/register-server-form.tsx");
  expect(source).toContain("fieldControlClass");
  expect(source).toContain('className: "min-h-11"');
  expect(source).not.toContain("h-10");
  expect(source).not.toMatch(/const controlClass\s*=/u);
  expect(source).not.toMatch(/const textareaClass\s*=/u);
});

it("keeps additive formErrorHint / errorHint copy for commerce and account honesty", () => {
  expect(read("site/src/lib/i18n/en/chrome.ts")).toContain("errorHint:");
  expect(read("site/src/lib/i18n/ru/chrome.ts")).toContain("errorHint:");
  expect(read("site/src/lib/subscriptions-i18n.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/commercial-i18n.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/order-case-i18n.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/plan-reviews-i18n.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/resource-commerce-i18n.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/license-control-i18n.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/organization-governance-copy.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/storage-maintenance-i18n.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/i18n/en/publishing.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/i18n/ru/publishing.ts")).toContain("formErrorHint:");
  expect(read("site/src/lib/i18n/en/product.ts")).toContain("downloadErrorHint:");
  expect(read("site/src/lib/i18n/ru/product.ts")).toContain("downloadErrorHint:");
});

it("locks license bind noServers empty to EmptyState with honesty hint copy", () => {
  const panel = read("site/src/components/license-control-panel.tsx");
  expect(panel).toContain("EmptyState");
  expect(panel).toContain("copy.noServers");
  expect(panel).toContain("copy.noServersHint");
  expect(panel).not.toMatch(/<p className="text-sm text-muted">\{copy\.noServers\}<\/p>/u);

  const i18n = read("site/src/lib/license-control-i18n.ts");
  expect(i18n).toContain("noServers:");
  expect(i18n).toContain("noServersHint:");
  expect(i18n.match(/noServersHint:/gu)?.length).toBe(2);
});

it("locks license control ghost pagination and token CTAs to size=touch", () => {
  const panel = read("site/src/components/license-control-panel.tsx");
  expect(panel).toContain('size="touch"');
  expect(panel).not.toContain('size="sm"');
  expect(panel.match(/size="touch"/gu)?.length ?? 0).toBeGreaterThanOrEqual(6);
  expect(panel).toContain("void loadServers(servers.page - 1)");
  expect(panel).toContain("void loadServers(servers.page + 1)");
  expect(panel).toContain("setSecret(null)");
  expect(panel).toMatch(/variant="ghost"\s+size="touch"/u);
});
