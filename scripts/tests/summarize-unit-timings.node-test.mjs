import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../summarize-unit-timings.mjs", import.meta.url));

test("summarize-unit-timings ranks files by duration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexus-unit-timings-"));
  try {
    const report = join(directory, "unit-tests.json");
    await writeFile(
      report,
      JSON.stringify({
        startTime: 1_000,
        testResults: [
          {
            name: "/repo/tests/slow.test.ts",
            status: "passed",
            startTime: 1_000,
            endTime: 3_500,
            assertionResults: [{}, {}, {}],
          },
          {
            name: "/repo/tests/fast.test.ts",
            status: "passed",
            startTime: 1_100,
            endTime: 1_200,
            assertionResults: [{}],
          },
        ],
      }),
    );
    const result = spawnSync(process.execPath, [script, report, "--top=1"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /slow\.test\.ts/);
    assert.doesNotMatch(result.stdout, /fast\.test\.ts/);
    assert.match(result.stdout, /parallel wall ≈ 2\.5s/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
