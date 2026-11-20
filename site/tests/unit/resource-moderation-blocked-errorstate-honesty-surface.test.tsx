import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/resources/components/resource-moderation-controls.tsx"),
  "utf8",
);
const copy = readFileSync(
  join(root, "site/src/features/library/resource-release-control-i18n.ts"),
  "utf8",
);

it("routes empty allowed-transitions moderation gate through ErrorState", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain("allowed.length === 0");
  expect(source).toContain("copy.noTransitionAllowed");
  expect(copy).toContain("noTransitionAllowed:");
  expect(source).toMatch(
    /allowed\.length === 0[\s\S]*?<ErrorState[\s\S]*?title=\{copy\.noTransitionAllowed\}/u,
  );
  expect(source).not.toContain("No moderation transition is allowed for the current status.");
  expect(source).toContain('role="status"');
  expect(source).not.toContain('role="alert"');
});
