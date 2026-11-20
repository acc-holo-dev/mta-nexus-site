import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Wave 59: quarantine SHA-256 label comes from storage-maintenance dictionary. */
it("locks quarantine hash label to storageMaintenanceCopy.hash", () => {
  const source = read(
    "site/src/features/moderation/components/admin-builds-quarantine-section.tsx",
  );
  const i18n = read("site/src/features/moderation/storage-maintenance-i18n.ts");
  expect(i18n).toContain('hash: "SHA-256"');
  expect(source).toContain("storageMaintenanceCopy");
  expect(source).toContain("hashLabel");
  expect(source).not.toContain("· SHA-256");
});
