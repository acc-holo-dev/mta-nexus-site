import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "resource-lifecycle-controls.tsx"),
  "utf8",
);

it("locks lifecycle blocked and unavailable-build notices to ErrorState with support CTAs", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain("<ErrorState");
  expect(source).toContain("title={copy.blocked}");
  expect(source).toContain("unavailableBuildSupportHref()");
  expect(source).toContain("stashSupportObjectContext");
  expect(source).toMatch(
    /actions\.length === 0 \? \(\s*<ErrorState[\s\S]*?title=\{copy\.blocked\}/u,
  );
  expect(source).toMatch(
    /buildAvailability !== "available" \? \(\s*<ErrorState[\s\S]*?unavailableBuildSupportHref\(\)/u,
  );
  expect(source).not.toContain('className="text-sm text-warning">{copy.blocked}</p>');
});
