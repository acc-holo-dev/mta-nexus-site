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

test("repository stability is checked after command execution and feeds the summary", () => {
  const script = read("scripts/release-evidence.mjs");
  assert.ok(script.indexOf("const finalShaResult") > script.indexOf('runGate("next_build"'));
  assert.match(script, /gates\.push\(runGate\("repository_stability"/u);
  assert.match(script, /dirty: dirty \|\| finalDirty/u);
});

test("CI preserves only the evidence JSON after successful or failed verification", () => {
  const workflow = read(".github/workflows/ci.yml");
  const section = workflow.slice(workflow.indexOf("      - name: Preserve core release evidence"), workflow.indexOf("      - name: Build production image"));
  assert.match(workflow, /id: release_verification/u);
  assert.match(section, /always\(\) && steps\.release_verification\.outcome != 'skipped'/u);
  assert.match(section, /uses: actions\/upload-artifact@v7\.0\.1/u);
  assert.match(section, /path: artifacts\/release-evidence\.json/u);
  assert.match(section, /if-no-files-found: error/u);
  assert.match(section, /retention-days: 14/u);
  assert.doesNotMatch(section, /continue-on-error|include-hidden-files|path: artifacts\s*$/mu);
});
