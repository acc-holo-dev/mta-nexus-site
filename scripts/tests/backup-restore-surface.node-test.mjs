import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("backup restore rehearsal refuses non-disposable Docker environments", () => {
  const script = read("scripts/check-backup-restore.mjs");

  assert.match(script, /process\.env\.GITHUB_ACTIONS/u);
  assert.match(script, /process\.env\.RUNNER_ENVIRONMENT/u);
  assert.match(script, /process\.env\.DOCKER_HOST/u);
  assert.match(script, /process\.env\.DOCKER_CONTEXT/u);
  assert.match(script, /docker", \["context", "show"\]/u);
  assert.match(script, /Only the default local Docker context is allowed/u);
});

test("backup restore rehearsal never targets repository or production volume names directly", () => {
  const script = read("scripts/check-backup-restore.mjs");

  assert.match(script, /randomUUID\(\)/u);
  assert.match(script, /BACKUP_RESTORE_LABEL/u);
  assert.match(script, /assertOwnedVolume/u);
  assert.match(script, /"volume", "rm", name/u);
  assert.doesNotMatch(script, /docker\s+volume\s+prune/u);
  assert.doesNotMatch(script, /down", "--volumes/u);
});

test("rehearsal covers migrated application database and private uploads transfer", () => {
  const script = read("scripts/check-backup-restore.mjs");

  assert.match(script, /packages", "db", "migrations/u);
  assert.match(script, /readdirSync\(migrationsDir\)/u);
  assert.match(script, /ON_ERROR_STOP=1/u);
  assert.match(script, /sourceSchemaFingerprint/u);
  assert.match(script, /restoredSchemaFingerprint/u);
  assert.match(script, /assert\.deepEqual\(/u);
  assert.match(script, /"pg_dump"/u);
  assert.match(script, /"pg_restore"/u);
  assert.match(script, /uploads\.tar\.gz/u);
  assert.match(script, /sourceDestroyedBeforeRestore/u);
  assert.match(script, /backupChecksumsVerified/u);
  assert.match(script, /databaseRowsRestored/u);
  assert.match(script, /applicationSchemaRestored/u);
  assert.match(script, /uploadFilesRestored/u);
});

test("temporary backup artifacts are forced to private file permissions", () => {
  const script = read("scripts/check-backup-restore.mjs");

  assert.match(script, /writeFileSync\(dbBackup, dump, \{ mode: 0o600 \}\)/u);
  assert.match(script, /chmodSync\(uploadsBackup, 0o600\)/u);
  assert.match(script, /Database backup must remain private/u);
  assert.match(script, /Uploads backup must remain private/u);
});

test("workflow runs backup restore as a separate disposable job", () => {
  const workflow = read(".github/workflows/ci.yml");

  assert.match(workflow, /^  backup-restore:/mu);
  assert.match(workflow, /name: Disposable backup restore/u);
  assert.match(
    workflow,
    /backup-restore:[\s\S]*?uses: actions\/checkout@v7[\s\S]*?persist-credentials: false/u,
  );
  assert.match(workflow, /node scripts\/check-backup-restore\.mjs/u);
});

test("production Compose is inspected without loading repository .env", () => {
  const script = read("scripts/check-backup-restore.mjs");

  assert.match(script, /COMPOSE_DISABLE_ENV_FILE: "true"/u);
  assert.match(script, /"--env-file",\s*emptyEnv/u);
  assert.match(script, /compose\.production\.yaml/u);
  assert.doesNotMatch(script, /readFileSync\([^\n]*\.env/u);
});
