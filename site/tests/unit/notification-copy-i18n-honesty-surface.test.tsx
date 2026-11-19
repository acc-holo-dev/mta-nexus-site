import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks notification notice copy to a dictionary without inline RU/EN user literals", () => {
  const source = read("site/src/features/notifications/notification-copy.ts");
  expect(source).toContain("const noticeCopy = {");
  expect(source).toContain("discussionModeration:");
  expect(source).toContain("buildLifecycle:");
  expect(source).toContain("resourceQa:");
  expect(source).toContain("newServerUpdate:");
  expect(source).toContain("awaitingReview:");
  expect(source).not.toMatch(/title:\s*locale === "ru" \?/u);
  expect(source).not.toMatch(/message:\s*locale === "ru" \?/u);
});

it("locks license expired/expiring action labels to dictionary keys", () => {
  const source = read("site/src/features/commerce/license-control-i18n.ts");
  expect(source).toContain('expired: "License expired"');
  expect(source).toContain('expiring: "Expiry warning"');
  expect(source).toContain('expired: "Срок лицензии истёк"');
  expect(source).toContain('expiring: "Предупреждение об истечении"');
  expect(source).toContain('"license.expired": "expired"');
  expect(source).toContain('"license.expiring": "expiring"');
  expect(source).not.toMatch(/action === "license\.expired"[\s\S]{0,80}locale === "ru"/u);
});
