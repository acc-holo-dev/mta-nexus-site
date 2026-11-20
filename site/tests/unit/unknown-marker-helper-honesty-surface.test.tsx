import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { formatUnknown, unknownMarker } from "../../src/lib/i18n/unknown";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Honesty lock: shared unknown marker helper and dictionary key stay wired. */
it("locks lib/i18n/unknown exports and en/ru errors.unknownMarker", () => {
  const helper = read("site/src/lib/i18n/unknown.ts");
  expect(helper).toContain("export function unknownMarker");
  expect(helper).toContain("export function formatUnknown");
  expect(helper).toContain("getDictionary(locale).errors.unknownMarker");

  const en = read("site/src/lib/i18n/en/errors.ts");
  const ru = read("site/src/lib/i18n/ru/errors.ts");
  expect(en).toContain("unknownMarker:");
  expect(ru).toContain("unknownMarker:");
});

/** Regression: empty/absent values resolve to the locale marker; present values pass through. */
it("formatUnknown maps null/empty to the marker and keeps present text", () => {
  const markerEn = unknownMarker("en");
  const markerRu = unknownMarker("ru");
  expect(markerEn.length).toBeGreaterThan(0);
  expect(markerRu.length).toBeGreaterThan(0);

  expect(formatUnknown("en", null)).toBe(markerEn);
  expect(formatUnknown("en", "")).toBe(markerEn);
  expect(formatUnknown("en", "x")).toBe("x");

  expect(formatUnknown("ru", null)).toBe(markerRu);
  expect(formatUnknown("ru", "")).toBe(markerRu);
  expect(formatUnknown("ru", "x")).toBe("x");
});
