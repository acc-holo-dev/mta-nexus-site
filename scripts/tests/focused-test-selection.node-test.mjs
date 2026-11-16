import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { selectFocusedTests } from "../focused-test-selection.mjs";

test("accepts colocated tests and rejects symlinks that escape allowed roots", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-focus-selection-"));
  const outside = mkdtempSync(join(tmpdir(), "nexus-focus-outside-"));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
  mkdirSync(join(root, "site/src"), { recursive: true });
  mkdirSync(join(root, "site/tests"), { recursive: true });
  writeFileSync(join(root, "site/src/view.test.ts"), "export {};\n");
  writeFileSync(join(root, "site/tests/db.test.ts"), "export {};\n");
  writeFileSync(join(root, "internal.test.ts"), "export {};\n");
  writeFileSync(join(outside, "outside.test.ts"), "export {};\n");
  symlinkSync(join(outside, "outside.test.ts"), join(root, "site/src/escape.test.ts"));
  symlinkSync(join(root, "internal.test.ts"), join(root, "site/src/other-root.test.ts"));
  assert.deepEqual(
    selectFocusedTests(
      root,
      ["site/src/view.test.ts", "site/tests/db.test.ts", "site/src/view.test.ts"],
      { compose: true },
    ),
    ["site/src/view.test.ts", "site/tests/db.test.ts"],
  );
  for (const file of [
    "site/src/escape.test.ts",
    "site/src/other-root.test.ts",
    "internal.test.ts",
    "site/src/missing.test.ts",
  ]) {
    assert.throws(
      () => selectFocusedTests(root, [file], { compose: true }),
      /Expected an existing test file/u,
    );
  }
});
