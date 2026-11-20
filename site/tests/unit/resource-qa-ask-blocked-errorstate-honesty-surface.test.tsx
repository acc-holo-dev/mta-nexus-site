import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for resource QA ask gating ErrorState notices (access/unavailable). */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/features/resources/components/resource-qa-panel.tsx";

it("locks QA accessRequired and ask unavailable notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="resource-qa-access-required"');
  expect(source).toContain('id="resource-qa-ask-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="resource-qa-access-required"\s+title=\{copy\.accessRequired\}\s+description=\{getDictionary\(locale\)\.errors\.formErrorHint\}/u,
  );
  expect(source).toMatch(
    /<ErrorState\s+id="resource-qa-ask-unavailable"\s+title=\{copy\.unavailable\}\s+description=\{copy\.unavailableDescription\}/u,
  );
  expect(source).not.toContain('className="text-xs text-muted">{copy.accessRequired}</p>');
});
