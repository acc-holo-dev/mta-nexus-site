import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/notifications/components/web-push-settings.tsx"),
  "utf8",
);

it("locks web-push load failures to ErrorState and keeps success as status", () => {
  expect(source).toContain('import { Button, ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="web-push-settings-status"');
  expect(source).toContain("<ErrorState");
  expect(source).toContain("title={copy.webPushError}");
  expect(source).toContain("description={copy.webPushErrorHint}");
  expect(source).toContain('role="status"');
  expect(source).not.toContain('role={shownStatus === "error" ? "alert" : "status"}');
  expect(source).not.toContain('role="alert"');
  expect(source).toMatch(/size="touch"/u);
  expect(readFileSync(join(root, "site/src/lib/i18n/en/admin.ts"), "utf8")).toContain(
    "webPushErrorHint:",
  );
  expect(readFileSync(join(root, "site/src/lib/i18n/ru/admin.ts"), "utf8")).toContain(
    "webPushErrorHint:",
  );
});
