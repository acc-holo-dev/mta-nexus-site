import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
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

test("respects fence character and length when checking links and headings", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-docs-fences-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const page = join(root, "page.md");
  writeFileSync(
    join(root, "target.md"),
    "# Real heading\n````markdown\n```\n# Hidden heading\n~~~\n````\n# After block\n",
  );
  writeFileSync(
    page,
    "````markdown\n```\n[example](ignored.md)\n~~~\n````\n[broken](absent.md)\n[hidden](target.md#hidden-heading)\n[real](target.md#after-block)\n",
  );
  const result = checkLinks([page]);
  assert.equal(result.checked, 3);
  assert.equal(result.errors.length, 2);
  assert(result.errors.some((error) => error.includes("missing absent.md")));
  assert(result.errors.some((error) => error.includes("missing heading target.md#hidden-heading")));
});

test("matches duplicate heading slugs that collide with explicit numbered headings", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-docs-slugs-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const page = join(root, "page.md");
  writeFileSync(page, "# Same\n# Same-1\n# Same\n[third](#same-2)\n[missing](#same-3)\n");
  const result = checkLinks([page]);
  assert.equal(result.checked, 2);
  assert.equal(result.errors.length, 1);
  assert(result.errors[0].includes("missing heading #same-3"));
});
