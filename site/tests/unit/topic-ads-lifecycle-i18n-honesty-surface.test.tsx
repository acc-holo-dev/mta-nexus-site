import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Honesty lock: topic/ads/lifecycle bilingual leftovers stay dictionary-backed. */
it("locks community-topic API errors to community dictionary keys", () => {
  const source = read("site/src/features/community/components/community-topic-form.tsx");
  const copy = read("site/src/lib/i18n/en/community.ts");
  expect(copy).toContain("topicValidationError:");
  expect(copy).toContain("topicPublishSignIn:");
  expect(copy).toContain("topicServerNotFound:");
  expect(source).toContain("copy.topicValidationError");
  expect(source).toContain("copy.topicPublishSignIn");
  expect(source).not.toContain("Sign in to publish a topic.");
  expect(source).not.toContain("codes: Record<string, { ru: string; en: string }>");
});

it("locks settings advertising preferences to ads-preferences-i18n", () => {
  const source = read(
    "site/src/features/accounts/components/settings-advertising-preferences-section.tsx",
  );
  const copy = read("site/src/features/accounts/ads-preferences-i18n.ts");
  expect(copy).toContain("heading:");
  expect(copy).toContain("rendererOff:");
  expect(source).toContain("adsPreferencesCopy");
  expect(source).toContain("copy.heading");
  expect(source).not.toContain("Advertising and placements");
});

it("locks admin ad placement labels to admin-ad-placement-i18n", () => {
  const source = read("site/src/features/moderation/components/admin-ad-placement-section.tsx");
  const copy = read("site/src/features/moderation/admin-ad-placement-i18n.ts");
  expect(copy).toContain("title:");
  expect(copy).toContain("emptyTitle:");
  expect(source).toContain("adminAdPlacementCopy");
  expect(source).toContain("copy.title");
  expect(source).not.toContain("Placement lifecycle");
});

it("locks resource-lifecycle bilingual labels to resource-commerce-i18n", () => {
  const source = read("site/src/features/resources/components/resource-lifecycle-controls.tsx");
  const copy = read("site/src/features/resources/resource-commerce-i18n.ts");
  expect(copy).toContain("resourceStatus:");
  expect(copy).toContain("buildUnavailableTitle:");
  expect(copy).toContain("openSupportCase:");
  expect(source).toContain("copy.resourceStatus");
  expect(source).toContain("copy.buildUnavailableTitle");
  expect(source).toContain("copy.openSupportCase");
  expect(source).toContain("copy.waitReviewNote");
  expect(source).toContain("copy.restoreDraftWarning");
  expect(source).not.toContain("Resource status");
  expect(source).not.toContain("This build is unavailable for public delivery");
  expect(source).not.toMatch(/locale === "ru"/u);
});
