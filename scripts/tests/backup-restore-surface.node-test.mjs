import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  BACKUP_RESTORE_EVIDENCE_FLAGS,
  BACKUP_RESTORE_LABEL,
  PRIVATE_BACKUP_FILE_MODE,
  assertBackupRestoreEvidence,
  assertDisposableRunnerPolicy,
  assertOwnedVolume,
  createBackupRestoreEnvironment,
  createBackupRestoreResult,
  extractBackupRestoreSpec,
  makePostgresFixture,
  registerCreatedVolume,
} from "../backup-restore-contract.mjs";

test("backup restore policy accepts only a disposable local GitHub-hosted runner", () => {
  assert.doesNotThrow(() =>
    assertDisposableRunnerPolicy(
      {
        GITHUB_ACTIONS: "true",
        RUNNER_ENVIRONMENT: "github-hosted",
      },
      "default",
    ),
  );

  for (const [env, context] of [
    [{ GITHUB_ACTIONS: "false", RUNNER_ENVIRONMENT: "github-hosted" }, "default"],
    [{ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "self-hosted" }, "default"],
    [
      {
        GITHUB_ACTIONS: "true",
        RUNNER_ENVIRONMENT: "github-hosted",
        DOCKER_HOST: "tcp://remote.example:2376",
      },
      "default",
    ],
    [
      {
        GITHUB_ACTIONS: "true",
        RUNNER_ENVIRONMENT: "github-hosted",
        DOCKER_CONTEXT: "remote",
      },
      "default",
    ],
    [{ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted" }, "desktop-linux"],
  ]) {
    assert.throws(() => assertDisposableRunnerPolicy(env, context));
  }
});

test("backup restore environment is explicit and does not inherit repository/application secrets", () => {
  const env = createBackupRestoreEnvironment({
    PATH: "/usr/bin",
    HOME: "/home/runner",
    DATABASE_URL: "postgres://must-not-leak",
    WEB_PUSH_VAPID_PRIVATE_KEY: "must-not-leak",
    SMTP_PASSWORD: "must-not-leak",
  });

  assert.equal(env.PATH, "/usr/bin");
  assert.equal(env.HOME, "/home/runner");
  assert.equal(env.COMPOSE_DISABLE_ENV_FILE, "true");
  assert.equal(env.DOMAIN, "backup-restore.invalid");
  assert.equal(env.POSTGRES_USER, "nexus");
  assert.equal(env.POSTGRES_DB, "mta_nexus");
  assert.equal("DATABASE_URL" in env, false);
  assert.equal("WEB_PUSH_VAPID_PRIVATE_KEY" in env, false);
  assert.equal("SMTP_PASSWORD" in env, false);
});

test("created volumes enter cleanup ownership before later validation can fail", () => {
  const registry = [];

  assert.throws(() =>
    registerCreatedVolume(registry, "expected-volume", "token-1", "unexpected-volume"),
  );
  assert.deepEqual(registry, [{ name: "expected-volume", token: "token-1" }]);
});

test("volume ownership labels prevent deleting unrelated Docker volumes", () => {
  assert.doesNotThrow(() =>
    assertOwnedVolume(
      {
        Name: "owned-volume",
        Labels: { [BACKUP_RESTORE_LABEL]: "token-1" },
      },
      "owned-volume",
      "token-1",
    ),
  );

  assert.throws(() =>
    assertOwnedVolume(
      {
        Name: "owned-volume",
        Labels: { [BACKUP_RESTORE_LABEL]: "someone-else" },
      },
      "owned-volume",
      "token-1",
    ),
  );
});

test("production storage topology is converted into an isolated PostgreSQL fixture", () => {
  const spec = extractBackupRestoreSpec({
    services: {
      postgres: {
        image: "postgres:18-alpine",
        volumes: [
          {
            type: "volume",
            source: "pgdata",
            target: "/var/lib/postgresql/data",
          },
        ],
      },
      app: {
        volumes: [
          {
            type: "volume",
            source: "uploads",
            target: "/data/uploads",
          },
        ],
      },
    },
  });

  assert.deepEqual(spec, {
    postgresImage: "postgres:18-alpine",
    postgresTarget: "/var/lib/postgresql/data",
    uploadsTarget: "/data/uploads",
  });

  const fixture = makePostgresFixture(spec, "sha256:fixture-image", "owned-pgdata", "secret-token");
  assert.equal(fixture.services.postgres.network_mode, "none");
  assert.equal(fixture.services.postgres.restart, "no");
  assert.equal(fixture.volumes.pgdata.name, "owned-pgdata");
  assert.equal(fixture.services.postgres.volumes[0].target, "/var/lib/postgresql/data");
});

test("backup artifacts use a private filesystem mode", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-backup-mode-"));
  const path = join(directory, "artifact");
  try {
    writeFileSync(path, "fixture", { mode: PRIVATE_BACKUP_FILE_MODE });
    assert.equal(statSync(path).mode & 0o777, PRIVATE_BACKUP_FILE_MODE);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("PASS evidence is impossible while any restore proof is missing", () => {
  const result = createBackupRestoreResult();
  for (const flag of BACKUP_RESTORE_EVIDENCE_FLAGS) result[flag] = true;

  assert.doesNotThrow(() => assertBackupRestoreEvidence(result));

  for (const flag of BACKUP_RESTORE_EVIDENCE_FLAGS) {
    const incomplete = { ...result, [flag]: false };
    assert.throws(() => assertBackupRestoreEvidence(incomplete), new RegExp(flag, "u"));
  }
});

test("workflow keeps backup restore as a separate disposable job", () => {
  const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");

  assert.match(workflow, /^ {2}backup-restore:/mu);
  assert.match(workflow, /name: Disposable backup restore/u);
  assert.match(
    workflow,
    /backup-restore:[\s\S]*?uses: actions\/checkout@v7[\s\S]*?persist-credentials: false/u,
  );
  assert.match(workflow, /node scripts\/check-backup-restore\.mjs/u);
});

test("backup restore rehearsal script still requires disposable runner and full evidence", () => {
  const script = readFileSync(resolve(process.cwd(), "scripts/check-backup-restore.mjs"), "utf8");
  assert.match(script, /assertDisposableRunnerPolicy\(/u);
  assert.match(script, /assertBackupRestoreEvidence\(/u);
  assert.match(script, /pg_dump/u);
  assert.match(script, /pg_restore/u);
  for (const flag of BACKUP_RESTORE_EVIDENCE_FLAGS) {
    assert.match(script, new RegExp(flag, "u"));
  }
  assert.match(script, /sourceDestroyedBeforeRestore\s*=\s*true/u);
  assert.doesNotMatch(script, /NEXUS_SKIP_DISPOSABLE|force.?production/iu);
});

test("rendered compose.production.yaml still matches the backup restore mount contract", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-backup-compose-"));
  const emptyEnv = join(directory, "empty.env");
  try {
    writeFileSync(emptyEnv, "", { mode: PRIVATE_BACKUP_FILE_MODE });
    const env = createBackupRestoreEnvironment({
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
    });
    const rendered = JSON.parse(
      execFileSync(
        "docker",
        [
          "compose",
          "--env-file",
          emptyEnv,
          "--project-name",
          "nexus-backup-contract-surface",
          "--file",
          resolve(process.cwd(), "compose.production.yaml"),
          "config",
          "--format",
          "json",
        ],
        {
          cwd: process.cwd(),
          env,
          encoding: "utf8",
          timeout: 60_000,
          maxBuffer: 16 * 1024 * 1024,
        },
      ),
    );

    assert.deepEqual(extractBackupRestoreSpec(rendered), {
      postgresImage: "postgres:18-alpine",
      postgresTarget: "/var/lib/postgresql",
      uploadsTarget: "/data/uploads",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
