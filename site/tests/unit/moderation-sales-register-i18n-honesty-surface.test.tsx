import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Honesty lock: moderation/sales/register leftover bilingual labels stay dictionary-backed. */
it("locks resource-moderation bilingual labels to resource-release-control-i18n", () => {
  const source = read("site/src/features/resources/components/resource-moderation-controls.tsx");
  const copy = read("site/src/features/library/resource-release-control-i18n.ts");
  expect(copy).toContain("resourceStatus:");
  expect(copy).toContain("releaseDraftWarning:");
  expect(copy).toContain("supportContext:");
  expect(source).toContain("copy.resourceStatus");
  expect(source).toContain("copy.releaseDraftWarning");
  expect(source).toContain("copy.supportContext");
  expect(source).not.toMatch(/locale === "ru"/u);
});

it("locks admin quarantine version-history label to admin dictionary", () => {
  const source = read(
    "site/src/features/moderation/components/admin-builds-quarantine-section.tsx",
  );
  const copy = read("site/src/lib/i18n/en/admin.ts");
  expect(copy).toContain("versionDecisionHistory:");
  expect(source).toContain("copy.versionDecisionHistory");
  expect(source).not.toContain("Version and decision history");
});

it("locks seller-sales day unit to seller-sales-i18n", () => {
  const source = read("site/src/features/commerce/server/seller-sales-report.tsx");
  const copy = read("site/src/features/commerce/seller-sales-i18n.ts");
  expect(copy).toContain("dayUnit:");
  expect(source).toContain("c.dayUnit");
  expect(source).not.toContain('locale === "ru" ? "дней" : "days"');
});

it("locks register-server language/region defaults to serverRegistration dictionary", () => {
  const source = read("site/src/features/servers/components/register-server-form.tsx");
  const copy = read("site/src/lib/i18n/en/publishing.ts");
  expect(copy).toContain("languageDefault:");
  expect(copy).toContain("regionPlaceholder:");
  expect(source).toContain("copy.languageDefault");
  expect(source).toContain("copy.regionPlaceholder");
  expect(source).not.toContain('locale === "ru" ? "Русский" : "English"');
});
