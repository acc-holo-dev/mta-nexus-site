import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("root exposes release:verify without adding runtime dependencies", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["release:verify"], "node scripts/release-evidence.mjs");
});

test("CI uses the evidence-producing core verification command", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /Verify project and write core release evidence/u);
  assert.match(workflow, /run: pnpm release:verify/u);
  assert.doesNotMatch(workflow, /name: Verify project\n\s+run: pnpm check/u);
});

test("core release evidence records lint as its own gate", () => {
  const script = read("scripts/release-evidence.mjs");
  const pkg = JSON.parse(read("package.json"));

  assert.equal(
    pkg.scripts.check,
    "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
  );
  assert.match(
    script,
    /runGate\("lint", pnpmCommand, \["lint"\]\)/u,
  );
  assert.match(
    script,
    /runGate\("typecheck", pnpmCommand, \["typecheck"\]\)/u,
  );
});

test("generated release evidence is not tracked by default", () => {
  const gitignore = read(".gitignore");
  assert.match(gitignore, /^artifacts\/$/mu);
});

test("evidence command does not serialize environment values or command output", () => {
  const script = read("scripts/release-evidence.mjs");
  assert.doesNotMatch(script, /JSON\.stringify\(process\.env\)/u);
  assert.doesNotMatch(script, /environment:\s*process\.env/u);
  assert.doesNotMatch(script, /stdout\s*:/u);
  assert.doesNotMatch(script, /stderr\s*:/u);
  assert.match(script, /process\.env\.DATABASE_URL/u);
  assert.match(script, /evidenceSha256/u);
});
