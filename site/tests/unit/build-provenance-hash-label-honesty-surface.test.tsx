import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Wave 61: provenance UI hash label is dictionary-backed. */
it("locks build-provenance SHA-256 label to provenance.hash", () => {
  const source = read("site/src/features/resources/components/build-provenance-details.tsx");
  const en = read("site/src/lib/i18n/en/product.ts");
  const ru = read("site/src/lib/i18n/ru/product.ts");
  expect(en).toContain('hash: "SHA-256"');
  expect(ru).toContain('hash: "SHA-256"');
  expect(source).toContain("copy.hash");
  expect(source).not.toContain(">SHA-256<");
  expect(source).not.toContain('"SHA-256"');
});
