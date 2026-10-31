import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve(import.meta.dirname, "../run-isolated-tests.mjs");
function run(failure = "") {
  const directory = mkdtempSync(join(tmpdir(), "nexus-isolated-runner-"));
  try {
    const log = join(directory, "calls.jsonl");
    writeFileSync(
      join(directory, "docker"),
      `#!${process.execPath}
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(process.env.NEXUS_TEST_LOG, JSON.stringify(args) + "\\n");
if (args.includes(process.env.NEXUS_TEST_FAIL)) process.exit(7);
`,
      { mode: 0o700 },
    );
    const result = spawnSync(process.execPath, [script], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        NEXUS_TEST_LOG: log,
        NEXUS_TEST_FAIL: failure,
      },
      encoding: "utf8",
    });
    const calls = readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    return { result, calls };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("isolated runs own different databases and remove only their database", () => {
  const first = run(),
    second = run();
  assert.equal(first.result.status, 0, first.result.stderr);
  assert.equal(second.result.status, 0, second.result.stderr);
  const database = first.calls[0].at(-1);
  assert.match(database, /^nexus_test_[0-9a-f]{32}$/u);
  assert.notEqual(database, second.calls[0].at(-1));
  assert.deepEqual(
    first.calls.map((args) => args.at(-1)),
    [database, "db:migrate", "test:unit", "test:database", database],
  );
  assert.ok(first.calls[2].includes("env") && first.calls[2].includes("-u"));
  assert.ok(first.calls[2].includes("NEXT_PUBLIC_APP_URL"));
  assert.ok(first.calls[4].includes("dropdb"));
  assert.ok(
    first.calls
      .slice(1, 4)
      .every((args) =>
        args.includes(`DATABASE_URL=postgres://nexus:nexus_secret@postgres:5432/${database}`),
      ),
  );
  assert.ok(
    first.calls.every(
      (args) =>
        !args.includes("--force") && !args.some((arg) => /DROP DATABASE|mta_nexus_test/u.test(arg)),
    ),
  );
});

for (const [failure, commands] of [
  ["createdb", 1],
  ["db:migrate", 3],
  ["test:unit", 4],
  ["test:database", 5],
  ["dropdb", 5],
]) {
  test(`isolated runner preserves ${failure} failure and cleans up only an owned database`, () => {
    const { result, calls } = run(failure);
    assert.equal(result.status, 7, result.stderr);
    assert.equal(calls.length, commands);
    if (failure === "createdb") assert.ok(!calls.some((args) => args.includes("dropdb")));
    else {
      assert.ok(calls.at(-1).includes("dropdb"));
      assert.equal(calls.at(-1).at(-1), calls[0].at(-1));
    }
  });
}
