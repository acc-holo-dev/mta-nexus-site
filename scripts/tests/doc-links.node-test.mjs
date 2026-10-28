import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLinks } from "../check-doc-links.mjs";

test("checks local files and headings without interpreting code blocks or remote links", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-docs-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const page = join(root, "page.md");
  writeFileSync(join(root, "target.md"), "# Раздел\n# Same\n# Same\n```\n# Not a heading\n```\n");
  writeFileSync(
    page,
    "[yes](target.md#раздел)\n[duplicate](target.md#same-1)\n[bad](target.md#missing)\n[code](target.md#not-a-heading)\n[file](absent.md)\n[web](https://example.invalid)\n```\n[example](not-a-link.md)\n```\n",
  );
  const result = checkLinks([page]);
  assert.equal(result.checked, 5);
  assert.equal(result.errors.length, 3);
  assert(result.errors.some((error) => error.includes("missing heading")));
  assert(result.errors.some((error) => error.includes("missing absent.md")));
});
