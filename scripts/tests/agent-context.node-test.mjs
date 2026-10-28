import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  checkContext,
  contextLimits,
  nextTask,
  parseTasks,
  queuePath,
  refreshManifest,
} from "../agent-context.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "nexus-context-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of Object.keys(contextLimits)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), "# Context\n");
  }
  writeFileSync(
    join(root, queuePath),
    "| PREP-01 | done | A | — | Prepare |\n| FIX-01 | ready | unassigned | PREP-01 | Fix |\n",
  );
  refreshManifest(root);
  return root;
}

test("valid short context passes and completed dependencies select the next task", (t) => {
  const root = fixture(t);
  assert.deepEqual(checkContext(root), []);
  const tasks = parseTasks(
    "| A-01 | blocked | A | — | Wait |\n| B-01 | ready | unassigned | A-01 | Fix |\n",
  );
  assert.equal(nextTask(tasks), undefined);
  tasks[0].state = "done";
  assert.equal(nextTask(tasks)?.id, "B-01");
  tasks[0].state = "review";
  assert.equal(nextTask(tasks)?.id, "A-01");
});

test("changed or newly added handbook files invalidate evidence until manifest refresh", (t) => {
  const root = fixture(t);
  appendFileSync(join(root, queuePath), "Changed acceptance\n");
  writeFileSync(join(root, "docs/handbook/extra.md"), "# New\n");
  const errors = checkContext(root);
  assert(errors.some((e) => e.includes("manifest drift")));
  assert(errors.some((e) => e.includes("inventory")));
  refreshManifest(root);
  assert.deepEqual(checkContext(root), []);
});

test("entry budgets and broken relative links fail without following external URLs", (t) => {
  const root = fixture(t);
  writeFileSync(
    join(root, "AGENTS.md"),
    `${"x".repeat(5501)}\n[missing](missing.md)\n[external](https://example.invalid)\n`,
  );
  const errors = checkContext(root);
  assert(errors.some((e) => e.includes("exceeds")));
  assert(errors.some((e) => e.includes("missing link target")));
  assert.equal(errors.length, 2);
});

test("ambiguous ownership, unknown prerequisites and dependency cycles fail", (t) => {
  const root = fixture(t);
  writeFileSync(
    join(root, queuePath),
    "| A-01 | active | unassigned | B-01 | Build |\n| B-01 | review | B | A-01, X-01 | Review |\n",
  );
  refreshManifest(root);
  const errors = checkContext(root);
  assert(errors.some((e) => e.includes("one implementation")));
  assert(errors.some((e) => e.includes("needs an owner")));
  assert(errors.some((e) => e.includes("invalid dependency")));
  assert(errors.some((e) => e.includes("Cyclic")));
});
