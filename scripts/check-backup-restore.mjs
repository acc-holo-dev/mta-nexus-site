import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BACKUP_RESTORE_LABEL,
  assertOwnedVolume,
  extractBackupRestoreSpec,
  makePostgresFixture,
} from "./backup-restore-contract.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function requireDisposableRunner() {
  assert.equal(
    process.env.GITHUB_ACTIONS,
    "true",
    "Backup/restore rehearsal requires GitHub Actions",
  );
  assert.equal(
    process.env.RUNNER_ENVIRONMENT,
    "github-hosted",
    "Backup/restore rehearsal requires a disposable GitHub-hosted runner",
  );
  assert(
    !process.env.DOCKER_HOST,
    "Remote Docker hosts are not allowed",
  );
  assert(
    !process.env.DOCKER_CONTEXT,
    "Alternate Docker contexts are not allowed",
  );
  const context = execFileSync("docker", ["context", "show"], {
    encoding: "utf8",
  }).trim();
  assert.equal(context, "default", "Only the default local Docker context is allowed");
}

function run() {
  requireDisposableRunner();

  const temp = mkdtempSync(join(tmpdir(), "nexus-backup-restore-"));
  const emptyEnv = join(temp, "empty.env");
  writeFileSync(emptyEnv, "", { mode: 0o600 });

  const env = Object.fromEntries(
    [
      "PATH",
      "HOME",
      "USER",
      "TMPDIR",
      "DOCKER_CONFIG",
      "XDG_RUNTIME_DIR",
      "SSL_CERT_FILE",
      "SSL_CERT_DIR",
    ]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  Object.assign(env, {
    COMPOSE_DISABLE_ENV_FILE: "true",
    DOMAIN: "backup-restore.invalid",
    ACME_EMAIL: "ci@backup-restore.invalid",
    AUTH_SECRET: "disposable-backup-restore-auth-secret",
    TRUSTED_PROXY_SECRET: "disposable-backup-restore-proxy-secret",
    POSTGRES_USER: "nexus",
    POSTGRES_DB: "mta_nexus",
    POSTGRES_PASSWORD: "disposable-config-render-only",
  });

  function docker(args, options = {}) {
    try {
      return execFileSync("docker", args, {
        cwd: root,
        env,
        encoding: options.encoding === undefined ? "utf8" : options.encoding,
        input: options.input,
        timeout: options.timeout ?? 120_000,
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      const stderr = Buffer.isBuffer(error.stderr)
        ? error.stderr.toString("utf8")
        : String(error.stderr || error.message);
      throw new Error(
        "docker " + args[0] + " failed: " + stderr.slice(-5000),
        { cause: error },
      );
    }
  }

  function compose(project, fixtureFile, ...args) {
    return String(
      docker(
        [
          "compose",
          "--env-file",
          emptyEnv,
          "--project-name",
          project,
          "--file",
          fixtureFile,
          ...args,
        ],
        { timeout: 180_000 },
      ),
    ).trim();
  }

  const createdVolumes = [];
  const projects = [];
  const result = {
    status: "FAIL",
    sourceDestroyedBeforeRestore: false,
    backupChecksumsVerified: false,
    databaseRowsRestored: false,
    applicationSchemaRestored: false,
    uploadFilesRestored: false,
    cleanupComplete: false,
  };

  function createOwnedVolume(name, token) {
    const existing = String(
      docker(["volume", "ls", "--quiet", "--filter", "name=^" + name + "$"]),
    ).trim();
    assert.equal(existing, "", "Refusing to adopt an existing Docker volume");
    const created = String(
      docker([
        "volume",
        "create",
        "--label",
        BACKUP_RESTORE_LABEL + "=" + token,
        name,
      ]),
    ).trim();

    // Register cleanup immediately after Docker reports success. Any later
    // assertion must still leave finally() able to remove this exact volume.
    createdVolumes.push({ name, token });
    assert.equal(created, name);

    const inspected = JSON.parse(
      String(docker(["volume", "inspect", name])),
    )[0];
    assertOwnedVolume(inspected, name, token);
  }

  function removeOwnedVolume(name, token) {
    const inspected = JSON.parse(
      String(docker(["volume", "inspect", name])),
    )[0];
    assertOwnedVolume(inspected, name, token);
    docker(["volume", "rm", name]);
    const remaining = String(
      docker(["volume", "ls", "--quiet", "--filter", "name=^" + name + "$"]),
    ).trim();
    assert.equal(remaining, "");
  }

  function helper(imageId, volumeName, token, args) {
    const inspected = JSON.parse(
      String(docker(["volume", "inspect", volumeName])),
    )[0];
    assertOwnedVolume(inspected, volumeName, token);
    return docker([
      "run",
      "--rm",
      "--network",
      "none",
      "--entrypoint",
      "sh",
      "--mount",
      "type=volume,src=" + volumeName + ",dst=/data",
      imageId,
      ...args,
    ]);
  }

  try {
    const rendered = JSON.parse(
      String(
        docker([
          "compose",
          "--env-file",
          emptyEnv,
          "--project-name",
          "nexus-backup-contract",
          "--file",
          join(root, "compose.production.yaml"),
          "config",
          "--format",
          "json",
        ]),
      ),
    );
    const spec = extractBackupRestoreSpec(rendered);
    result.productionPostgresImage = spec.postgresImage;

    docker(["pull", spec.postgresImage], { timeout: 180_000 });
    const imageInfo = JSON.parse(
      String(docker(["image", "inspect", spec.postgresImage])),
    )[0];
    const imageId = imageInfo.Id;
    result.postgresImageId = imageId;
    result.postgresRepoDigests = imageInfo.RepoDigests ?? [];

    const sourceToken = randomUUID();
    const sourceProject = "nexus-backup-source-" + sourceToken;
    const sourcePg = sourceProject + "-pgdata";
    const sourceUploads = sourceProject + "-uploads";
    const sourceFixture = join(temp, "source-compose.json");
    projects.push({ name: sourceProject, fixture: sourceFixture });

    createOwnedVolume(sourcePg, sourceToken);
    createOwnedVolume(sourceUploads, sourceToken);
    writeFileSync(
      sourceFixture,
      JSON.stringify(
        makePostgresFixture(spec, imageId, sourcePg, sourceToken),
      ),
      { mode: 0o600 },
    );

    compose(
      sourceProject,
      sourceFixture,
      "up",
      "--detach",
      "--wait",
      "--wait-timeout",
      "90",
      "--no-build",
      "--pull",
      "never",
      "postgres",
    );
    const sourceContainer = compose(
      sourceProject,
      sourceFixture,
      "ps",
      "--quiet",
      "postgres",
    );
    assert.match(sourceContainer, /^[a-f0-9]{64}$/);

    const sql = (container, query) =>
      String(
        docker([
          "exec",
          container,
          "psql",
          "-X",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "nexus_backup",
          "-d",
          "nexus_backup",
          "-Atc",
          query,
        ]),
      ).trim();

    const migrationsDir = join(root, "packages", "db", "migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((name) => /^\d+.*\.sql$/u.test(name))
      .sort((a, b) => a.localeCompare(b));
    assert(migrationFiles.length > 0, "No SQL migrations were found");

    for (const migration of migrationFiles) {
      docker(
        [
          "exec",
          "-i",
          sourceContainer,
          "psql",
          "-X",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          "nexus_backup",
          "-d",
          "nexus_backup",
          "-f",
          "-",
        ],
        { input: readFileSync(join(migrationsDir, migration)) },
      );
    }

    result.migrationsApplied = migrationFiles.length;
    result.latestMigration = migrationFiles.at(-1);

    const schemaFingerprint = (container) => ({
      columns: sql(
        container,
        "SELECT md5(string_agg(" +
          "table_name || ':' || column_name || ':' || data_type || ':' || " +
          "is_nullable || ':' || coalesce(column_default, ''), E'\\n' " +
          "ORDER BY table_name, ordinal_position)) " +
          "FROM information_schema.columns WHERE table_schema = 'public';",
      ),
      tableCount: Number(
        sql(
          container,
          "SELECT count(*) FROM information_schema.tables " +
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE';",
        ),
      ),
      indexCount: Number(
        sql(
          container,
          "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public';",
        ),
      ),
      constraintCount: Number(
        sql(
          container,
          "SELECT count(*) FROM pg_constraint c " +
            "JOIN pg_namespace n ON n.oid = c.connamespace " +
            "WHERE n.nspname = 'public';",
        ),
      ),
    });

    sql(
      sourceContainer,
      "CREATE TABLE backup_probe (id integer PRIMARY KEY, value text NOT NULL); " +
        "INSERT INTO backup_probe VALUES (1, 'alpha'), (2, 'beta');",
    );

    const sourceSchemaFingerprint = schemaFingerprint(sourceContainer);
    assert(
      sourceSchemaFingerprint.columns &&
        sourceSchemaFingerprint.tableCount > 0 &&
        sourceSchemaFingerprint.indexCount > 0 &&
        sourceSchemaFingerprint.constraintCount > 0,
      "Application migrations did not produce a complete schema fingerprint",
    );
    result.sourceSchemaFingerprint = sourceSchemaFingerprint;

    helper(imageId, sourceUploads, sourceToken, [
      "-eu",
      "-c",
      "mkdir -p /data/resources /data/avatars; " +
        "printf archive-probe > /data/resources/build.zip; " +
        "printf avatar-probe > /data/avatars/user.txt",
    ]);

    const dbBackup = join(temp, "database.dump");
    const dump = docker(
      [
        "exec",
        sourceContainer,
        "pg_dump",
        "-U",
        "nexus_backup",
        "-d",
        "nexus_backup",
        "--format=custom",
        "--no-owner",
        "--no-privileges",
      ],
      { encoding: null },
    );
    writeFileSync(dbBackup, dump, { mode: 0o600 });
    assert(statSync(dbBackup).size > 0, "Database dump is empty");
    assert.equal(
      statSync(dbBackup).mode & 0o777,
      0o600,
      "Database backup must remain private",
    );

    const uploadsBackup = join(temp, "uploads.tar.gz");
    docker([
      "run",
      "--rm",
      "--network",
      "none",
      "--entrypoint",
      "sh",
      "--mount",
      "type=volume,src=" + sourceUploads + ",dst=/data,readonly",
      "--mount",
      "type=bind,src=" + temp + ",dst=/backup",
      imageId,
      "-eu",
      "-c",
      "tar -C /data -czf /backup/uploads.tar.gz .",
    ]);
    assert(statSync(uploadsBackup).size > 0, "Uploads archive is empty");
    chmodSync(uploadsBackup, 0o600);
    assert.equal(
      statSync(uploadsBackup).mode & 0o777,
      0o600,
      "Uploads backup must remain private",
    );

    result.databaseBackupSha256 = sha256(dbBackup);
    result.uploadsBackupSha256 = sha256(uploadsBackup);

    compose(sourceProject, sourceFixture, "down", "--timeout", "10");
    removeOwnedVolume(sourcePg, sourceToken);
    removeOwnedVolume(sourceUploads, sourceToken);
    result.sourceDestroyedBeforeRestore = true;

    assert.equal(
      sha256(dbBackup),
      result.databaseBackupSha256,
      "Database backup checksum changed after source destruction",
    );
    assert.equal(
      sha256(uploadsBackup),
      result.uploadsBackupSha256,
      "Uploads backup checksum changed after source destruction",
    );
    result.backupChecksumsVerified = true;

    const restoreToken = randomUUID();
    const restoreProject = "nexus-backup-restore-" + restoreToken;
    const restorePg = restoreProject + "-pgdata";
    const restoreUploads = restoreProject + "-uploads";
    const restoreFixture = join(temp, "restore-compose.json");
    projects.push({ name: restoreProject, fixture: restoreFixture });

    createOwnedVolume(restorePg, restoreToken);
    createOwnedVolume(restoreUploads, restoreToken);
    writeFileSync(
      restoreFixture,
      JSON.stringify(
        makePostgresFixture(spec, imageId, restorePg, restoreToken),
      ),
      { mode: 0o600 },
    );

    compose(
      restoreProject,
      restoreFixture,
      "up",
      "--detach",
      "--wait",
      "--wait-timeout",
      "90",
      "--no-build",
      "--pull",
      "never",
      "postgres",
    );
    const restoreContainer = compose(
      restoreProject,
      restoreFixture,
      "ps",
      "--quiet",
      "postgres",
    );
    assert.match(restoreContainer, /^[a-f0-9]{64}$/);

    docker(
      [
        "exec",
        "-i",
        restoreContainer,
        "pg_restore",
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        "-U",
        "nexus_backup",
        "-d",
        "nexus_backup",
      ],
      { input: readFileSync(dbBackup) },
    );

    docker([
      "run",
      "--rm",
      "--network",
      "none",
      "--entrypoint",
      "sh",
      "--mount",
      "type=volume,src=" + restoreUploads + ",dst=/data",
      "--mount",
      "type=bind,src=" + temp + ",dst=/backup,readonly",
      imageId,
      "-eu",
      "-c",
      "tar -C /data -xzf /backup/uploads.tar.gz",
    ]);

    const rows = sql(
      restoreContainer,
      "SELECT string_agg(id::text || ':' || value, ',' ORDER BY id) FROM backup_probe;",
    );
    assert.equal(rows, "1:alpha,2:beta");
    result.databaseRowsRestored = true;

    const restoredSchemaFingerprint = schemaFingerprint(restoreContainer);
    assert.deepEqual(
      restoredSchemaFingerprint,
      sourceSchemaFingerprint,
      "Restored application schema does not match the migrated source schema",
    );
    result.applicationSchemaRestored = true;
    result.restoredSchemaFingerprint = restoredSchemaFingerprint;

    const restoredFiles = String(
      helper(imageId, restoreUploads, restoreToken, [
        "-eu",
        "-c",
        "printf '%s|%s' " +
          '"$(cat /data/resources/build.zip)" ' +
          '"$(cat /data/avatars/user.txt)"',
      ]),
    ).trim();
    assert.equal(restoredFiles, "archive-probe|avatar-probe");
    result.uploadFilesRestored = true;

    result.status = "PASS";
  } catch (error) {
    result.error = error.message;
  } finally {
    for (const project of projects.reverse()) {
      try {
        compose(project.name, project.fixture, "down", "--timeout", "10");
      } catch (error) {
        result.status = "FAIL";
        result.cleanupError =
          (result.cleanupError ? result.cleanupError + "; " : "") +
          error.message;
      }
    }

    for (const volume of createdVolumes.reverse()) {
      try {
        const exists = String(
          docker([
            "volume",
            "ls",
            "--quiet",
            "--filter",
            "name=^" + volume.name + "$",
          ]),
        ).trim();
        if (exists) removeOwnedVolume(volume.name, volume.token);
      } catch (error) {
        result.status = "FAIL";
        result.cleanupError =
          (result.cleanupError ? result.cleanupError + "; " : "") +
          error.message;
      }
    }

    result.cleanupComplete =
      createdVolumes.every((volume) => {
        try {
          return (
            String(
              docker([
                "volume",
                "ls",
                "--quiet",
                "--filter",
                "name=^" + volume.name + "$",
              ]),
            ).trim() === ""
          );
        } catch {
          return false;
        }
      });

    if (!result.cleanupComplete) result.status = "FAIL";

    console.log(JSON.stringify(result, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        "## Disposable backup/restore rehearsal\n\n```json\n" +
          JSON.stringify(result, null, 2) +
          "\n```\n",
      );
    }

    rmSync(temp, { recursive: true, force: true });
  }

  assert.equal(result.status, "PASS");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
