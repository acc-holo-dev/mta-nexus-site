import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for market publisherUnavailable ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "site/src/features/resources/server/detail-page.tsx";

it("locks market publisherUnavailable notice to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="market-publisher-unavailable"');
  expect(source).toMatch(
    /<ErrorState id="market-publisher-unavailable" title=\{copy\.publisherUnavailable\}/,
  );
  expect(source).not.toContain('className="text-muted">{copy.publisherUnavailable}</p>');
});
