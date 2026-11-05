import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const policyScript = fileURLToPath(new URL("../ci-policy.mjs", import.meta.url));

function classifyRename(t, from, to) {
  const root = mkdtempSync(join(tmpdir(), "nexus-ci-rename-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(root, "missing-global-config"),
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
  const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" }).trim();
  git("init", "-q");
  mkdirSync(dirname(join(root, from)), { recursive: true });
  mkdirSync(dirname(join(root, to)), { recursive: true });
  writeFileSync(join(root, from), "unchanged content to ensure git detects a rename\n");
  git("add", "--", from);
  git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD");
  renameSync(join(root, from), join(root, to));
  git("add", "-A");
  git("commit", "-qm", "rename");
  // Confirm the fixture exercises Git's default rename detection.
  assert.match(git("diff", "--name-status", base, "HEAD"), /^R100\s/u);
  const event = join(root, "event.json");
  const output = join(root, "output.txt");
  writeFileSync(event, JSON.stringify({ pull_request: { base: { sha: base } } }));
  writeFileSync(output, "");
  const result = spawnSync(process.execPath, [policyScript], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...env,
      GITHUB_EVENT_PATH: event,
      GITHUB_OUTPUT: output,
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/1/merge",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return Object.fromEntries(
    readFileSync(output, "utf8")
      .trim()
      .split("\n")
      .map((line) => line.split("=")),
  );
}

test("a move from a full-acceptance script to docs keeps full acceptance", (t) => {
  assert.deepEqual(classifyRename(t, "scripts/gate.mjs", "docs/gate.md"), {
    code: "true",
    unit_only: "false",
    full: "true",
  });
});

test("a docs-only main push after a security push still requires full acceptance", (t) => {
  const root = mkdtempSync(join(tmpdir(), "nexus-ci-main-push-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(root, "missing-global-config"),
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
  const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" }).trim();
  git("init", "-q");
  writeFileSync(join(root, "README.md"), "initial\n");
  git("add", "--all");
  git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD");
  mkdirSync(join(root, "packages/security/src"), { recursive: true });
  writeFileSync(join(root, "packages/security/src/policy.ts"), "export const security = true;\n");
  git("add", "--all");
  git("commit", "-qm", "security change");
  const security = git("rev-parse", "HEAD");
  writeFileSync(join(root, "README.md"), "docs only\n");
  git("add", "--all");
  git("commit", "-qm", "documentation change");
  const docs = git("rev-parse", "HEAD");
  const event = join(root, "event.json");
  const output = join(root, "output.txt");
  // The second run can cancel the first even though its own diff is docs-only.
  for (const [before, head] of [
    [base, security],
    [security, docs],
  ]) {
    git("checkout", "-q", "--detach", head);
    writeFileSync(event, JSON.stringify({ before }));
    writeFileSync(output, "");
    const result = spawnSync(process.execPath, [policyScript], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...env,
        GITHUB_EVENT_PATH: event,
        GITHUB_OUTPUT: output,
        GITHUB_EVENT_NAME: "push",
        GITHUB_REF: "refs/heads/main",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      Object.fromEntries(
        readFileSync(output, "utf8")
          .trim()
          .split("\n")
          .map((line) => line.split("=")),
      ),
      {
        code: "true",
        unit_only: "false",
        full: "true",
      },
    );
  }
});

test("a move from application code to a UI component keeps the wider fast profile", (t) => {
  assert.deepEqual(
    classifyRename(t, "apps/web/src/app/example.tsx", "apps/web/src/components/example.tsx"),
    { code: "true", unit_only: "false", full: "false" },
  );
});
