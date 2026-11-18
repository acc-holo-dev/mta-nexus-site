import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("locks verification workspace readError to unavailableHint", () => {
  const source = read("site/src/features/moderation/components/verification-workspace.tsx");
  expect(source).toContain('id="verification-workspace-unavailable"');
  expect(source).toContain("description={copy.unavailableHint}");
  expect(read("site/src/features/trust/verification-workspace-copy.ts")).toContain(
    "unavailableHint:",
  );
});

it("locks register-server organizations load failure to recovery hint", () => {
  const form = read("site/src/features/servers/components/register-server-form.tsx");
  expect(form).toContain("description={copy.organizationsUnavailableHint}");
  expect(read("site/src/lib/i18n/en/publishing.ts")).toContain("organizationsUnavailableHint:");
  expect(read("site/src/lib/i18n/ru/publishing.ts")).toContain("organizationsUnavailableHint:");
});
