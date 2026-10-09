import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

for (const mode of ["development", "production"]) test(`public metadata/pages share isolated real RSC reads in ${mode}`, () => {
  const fixture = fileURLToPath(new URL("./request-page-cache.fixture.mjs", import.meta.url));
  const result = spawnSync(process.execPath, ["--conditions=react-server", fixture], {
    encoding: "utf8", timeout: 30_000, env: { ...process.env, NODE_ENV: mode },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.deepEqual(summary, { routes: 4, renders: 20, singleReadPerRender: true, requestIsolation: true });
});
