import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for resource QA ask gating ErrorState notices (access/unavailable). */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/components/resource-qa-panel.tsx";

it("locks QA accessRequired and ask unavailable notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="resource-qa-access-required"');
  expect(source).toContain('id="resource-qa-ask-unavailable"');
  expect(source).toMatch(
    /<ErrorState id="resource-qa-access-required" title=\{copy\.accessRequired\}/,
  );
  expect(source).toMatch(
    /<ErrorState id="resource-qa-ask-unavailable" title=\{copy\.unavailable\}/,
  );
  expect(source).not.toContain('className="text-xs text-muted">{copy.accessRequired}</p>');
});
