import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Honesty lock: Wave 58 resource surfaces keep MTA / SHA-256 labels dictionary-backed. */
it("locks build-screen MTA minimum label to resource-management-i18n", () => {
  const source = read("site/src/features/resources/server/build-screen.tsx");
  const management = read("site/src/features/resources/resource-management-i18n.ts");
  expect(management).toContain("mta:");
  expect(source).toContain("getResourceManagementCopy");
  expect(source).toContain("managementCopy.mta");
  expect(source).not.toContain("MTA:");
});

it("locks detail-page MTA and SHA-256 labels to product / build-package dictionaries", () => {
  const source = read("site/src/features/resources/server/detail-page.tsx");
  const product = read("site/src/lib/i18n/en/product.ts");
  const packageCopy = read("site/src/features/resources/build-package-i18n.ts");
  expect(product).toContain("mtaVersion:");
  expect(packageCopy).toContain("sha256Label:");
  expect(source).toContain("buildPackageCopy");
  expect(source).toContain("copy.mtaVersion");
  expect(source).toContain("packageCopy.sha256Label");
  expect(source).not.toContain("MTA:");
  expect(source).not.toContain("SHA-256:");
});
