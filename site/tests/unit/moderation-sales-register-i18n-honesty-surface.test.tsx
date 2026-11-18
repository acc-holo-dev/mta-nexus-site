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
  expect(copy).toContain("websiteUrlPlaceholder:");
  expect(copy).toContain("discordUrlPlaceholder:");
  expect(copy).toContain("gameplayTagsPlaceholder:");
  expect(copy).toContain("mediaUrlsPlaceholder:");
  expect(source).toContain("copy.languageDefault");
  expect(source).toContain("copy.regionPlaceholder");
  expect(source).toContain("copy.websiteUrlPlaceholder");
  expect(source).toContain("copy.discordUrlPlaceholder");
  expect(source).toContain("copy.gameplayTagsPlaceholder");
  expect(source).toContain("copy.mediaUrlsPlaceholder");
  expect(source).not.toContain('locale === "ru" ? "Русский" : "English"');
  expect(source).not.toContain('placeholder="https://..."');
  expect(source).not.toContain('placeholder="roleplay, economy, freeroam"');
});

it("locks server-details and publishing form placeholders to locale dictionaries", () => {
  const details = read("site/src/features/servers/components/server-details-form.tsx");
  const management = read("site/src/lib/i18n/en/servers.ts");
  expect(management).toContain("websiteUrlPlaceholder:");
  expect(management).toContain("gameplayTagsPlaceholder:");
  expect(details).toContain("copy.websiteUrlPlaceholder");
  expect(details).toContain("copy.gameplayTagsPlaceholder");
  expect(details).not.toContain('placeholder="https://discord.gg/..."');

  const publishingForm = read("site/src/features/resources/components/new-resource-form.tsx");
  const publishing = read("site/src/lib/i18n/en/publishing.ts");
  expect(publishing).toContain("dependenciesPlaceholder:");
  expect(publishingForm).toContain("copy.dependenciesPlaceholder");
  expect(publishingForm).not.toContain('placeholder="core-ui, vehicle-pack"');

  const compatibility = read(
    "site/src/features/resources/components/resource-compatibility-form.tsx",
  );
  const managementCopy = read("site/src/features/resources/resource-management-i18n.ts");
  expect(managementCopy).toContain("mtaPlaceholder:");
  expect(compatibility).toContain("copy.mtaPlaceholder");
  expect(compatibility).not.toContain('placeholder="1.6.0"');
});
