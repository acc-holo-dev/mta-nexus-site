import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks server claim session failure to recovery hint", () => {
  const page = read("site/src/app/servers/[slug]/page.tsx");
  expect(page).toContain('id="server-claim-session-unavailable"');
  expect(page).toContain("description={copy.claimSessionUnavailableHint}");
  expect(read("site/src/lib/i18n/en/servers.ts")).toContain("claimSessionUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/servers.ts")).toContain("claimSessionUnavailableHint:");
});

it("locks discussion count and dependency catalogue failures to recovery hints", () => {
  expect(read("site/src/features/community/components/content-discussion.tsx")).toContain(
    "description={copy.countUnavailableHint}",
  );
  expect(read("site/src/features/community/content-discussion-copy.ts")).toContain(
    "countUnavailableHint:",
  );
  expect(read("site/src/features/resources/components/product-dependency-list.tsx")).toContain(
    "description={copy.resolutionUnavailableHint}",
  );
  expect(read("site/src/features/resources/components/reverse-dependency-list.tsx")).toContain(
    "description={copy.reverseUnavailableHint}",
  );
  expect(read("site/src/lib/i18n/en/product.ts")).toContain("resolutionUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/product.ts")).toContain("reverseUnavailableHint:");
});

it("locks object-report null auth and QA ask-unavailable to session/load honesty copy", () => {
  const report = read("site/src/features/moderation/components/object-report-form.tsx");
  expect(report).toContain("title={copy.identityUnavailable}");
  expect(report).toContain("description={copy.identityUnavailableDescription}");
  expect(read("site/src/features/moderation/platform-report-i18n.ts")).toContain(
    "identityUnavailableDescription:",
  );
  const qa = read("site/src/features/resources/components/resource-qa-panel.tsx");
  expect(qa).toContain('id="resource-qa-ask-unavailable"');
  expect(qa).toContain("title={copy.unavailable}");
  expect(qa).toContain("description={copy.unavailableDescription}");
  expect(qa).toContain("description={copy.identityUnavailableDescription}");
});
