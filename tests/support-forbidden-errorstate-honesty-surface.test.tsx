import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/support-page.tsx"), "utf8");

it("locks support staff-forbidden notice to ErrorState with stable id", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="support-forbidden"');
  expect(source).toContain("title={copy.forbidden}");
  expect(source).toMatch(
    /staff && !can\(actor, "admin\.moderation"\)[\s\S]*?<ErrorState[\s\S]*?id="support-forbidden"[\s\S]*?title=\{copy\.forbidden\}/u,
  );
  expect(source).not.toContain("<ErrorState\n          title={copy.forbidden}");
});
