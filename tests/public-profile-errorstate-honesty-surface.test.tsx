import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "apps/web/src/components/public-profile-form.tsx"), "utf8");

it("locks public profile form failures to ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Avatar, Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain('id="public-profile-form-notice-unavailable"');
  expect(source).toMatch(
    /<ErrorState\s+id="public-profile-form-notice-unavailable"[\s\S]*?title=\{notice\.text\}/u,
  );
  expect(source).toContain('role="status"');
  expect(source).toContain("text-success");
  expect(source).not.toContain('role={notice.error ? "alert" : "status"}');
  expect(source).not.toContain('role="alert"');
  expect(source).toMatch(/min-h-11|size="touch"/u);
});
