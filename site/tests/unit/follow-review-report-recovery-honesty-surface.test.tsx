import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks follow workspace load and missing-target ErrorStates to recovery hints", () => {
  const source = read("site/src/features/community/components/follow-workspace.tsx");
  expect(source).toContain("description={copy.pageErrorHint}");
  expect(source).toContain('id="follow-unavailable-target"');
  expect(source).toContain("description={copy.unavailableTargetHint}");
  expect(read("site/src/features/community/follow-workspace-copy.ts")).toContain(
    "unavailableTargetHint:",
  );
  expect(read("site/src/features/community/follow-workspace-copy.ts")).toContain("pageErrorHint:");
});

it("locks missing reported review body to reportReviewUnavailable honesty copy", () => {
  const screen = read("site/src/features/resources/server/resource-review-report-screen.tsx");
  expect(screen).toContain('id="resource-review-report-unavailable"');
  expect(screen).toContain("title={copy.reportReviewUnavailable}");
  expect(screen).toContain("description={copy.reportReviewUnavailableHint}");
  expect(read("site/src/features/resources/resource-review-i18n.ts")).toContain(
    "reportReviewUnavailableHint:",
  );
});
