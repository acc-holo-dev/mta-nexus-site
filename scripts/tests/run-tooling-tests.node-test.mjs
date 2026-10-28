import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { discoverToolingTests } from "../run-tooling-tests.mjs";

test("tooling discovery includes nested suites, excluding Compose fixtures and symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "nexus-tooling-discovery-"));
  try {
    for (const name of [
      "scripts/tests/z.node-test.mjs",
      "scripts/tests/nested/a.node-test.mjs",
      "scripts/tests/nested/mail-worker-compose.node-test.mjs",
      "scripts/tests/nested/helper.mjs",
      "packages/db/scripts/second/b.node-test.mjs",
      "packages/db/scripts/recovery-compose.node-test.mjs",
    ]) {
      const path = join(root, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "// fixture\n");
    }
    await symlink(
      join(root, "scripts/tests/nested"),
      join(root, "scripts/tests/nested-link"),
      "dir",
    );
    assert.deepEqual(discoverToolingTests(undefined, { root }), [
      "packages/db/scripts/second/b.node-test.mjs",
      "scripts/tests/nested/a.node-test.mjs",
      "scripts/tests/z.node-test.mjs",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing tooling roots fail rather than silently passing", async () => {
  const root = await mkdtemp(join(tmpdir(), "nexus-tooling-missing-"));
  try {
    assert.throws(() => discoverToolingTests(undefined, { root }), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("empty tooling roots cause an unsuccessful CLI result", async () => {
  const root = await mkdtemp(join(tmpdir(), "nexus-tooling-empty-"));
  try {
    await mkdir(join(root, "scripts/tests"), { recursive: true });
    await mkdir(join(root, "packages/db/scripts"), { recursive: true });
    const result = spawnSync(process.execPath, [resolve("scripts/run-tooling-tests.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No tooling tests discovered/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
