import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

export const BACKUP_RESTORE_LABEL = "io.nexus.backup-restore-test";
export const PRIVATE_BACKUP_FILE_MODE = 0o600;

/** Reserve a private host-owned inode before a container writes the archive. */
export function createPrivateBackupFile(path) {
  writeFileSync(path, Buffer.alloc(0), {
    flag: "wx",
    mode: PRIVATE_BACKUP_FILE_MODE,
  });
}

const PASSTHROUGH_ENV_KEYS = Object.freeze([
  "PATH",
  "HOME",
  "USER",
  "TMPDIR",
  "DOCKER_CONFIG",
  "XDG_RUNTIME_DIR",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
]);

export const BACKUP_RESTORE_EVIDENCE_FLAGS = Object.freeze([
  "sourceDestroyedBeforeRestore",
  "backupChecksumsVerified",
  "databaseRowsRestored",
  "applicationSchemaRestored",
  "applicationRowsRestored",
  "migrationLedgerRestored",
  "uploadFilesRestored",
  "cleanupComplete",
]);

export function assertDisposableRunnerPolicy(env, dockerContext) {
  assert.equal(
    env.GITHUB_ACTIONS,
    "true",
    "Backup/restore rehearsal requires GitHub Actions",
  );
  assert.equal(
    env.RUNNER_ENVIRONMENT,
    "github-hosted",
    "Backup/restore rehearsal requires a disposable GitHub-hosted runner",
  );
  assert(!env.DOCKER_HOST, "Remote Docker hosts are not allowed");
  assert(!env.DOCKER_CONTEXT, "Alternate Docker contexts are not allowed");
  assert.equal(
    dockerContext,
    "default",
    "Only the default local Docker context is allowed",
  );
}

export function createBackupRestoreEnvironment(sourceEnv = process.env) {
  const env = Object.fromEntries(
    PASSTHROUGH_ENV_KEYS
      .filter((key) => sourceEnv[key] !== undefined)
      .map((key) => [key, sourceEnv[key]]),
  );

  return {
    ...env,
    COMPOSE_DISABLE_ENV_FILE: "true",
    DOMAIN: "backup-restore.invalid",
    ACME_EMAIL: "ci@backup-restore.invalid",
    AUTH_SECRET: "disposable-backup-restore-auth-secret",
    TRUSTED_PROXY_SECRET: "disposable-backup-restore-proxy-secret",
    POSTGRES_USER: "nexus",
    POSTGRES_DB: "mta_nexus",
    POSTGRES_PASSWORD: "disposable-config-render-only",
  };
}

export function registerCreatedVolume(
  registry,
  name,
  token,
  createdName,
) {
  registry.push({ name, token });
  assert.equal(createdName, name, "Docker returned an unexpected volume name");
}

export function createBackupRestoreResult() {
  return {
    status: "FAIL",
    ...Object.fromEntries(
      BACKUP_RESTORE_EVIDENCE_FLAGS.map((flag) => [flag, false]),
    ),
  };
}

export function assertBackupRestoreEvidence(result) {
  for (const flag of BACKUP_RESTORE_EVIDENCE_FLAGS) {
    assert.equal(
      result[flag],
      true,
      `Backup/restore evidence is incomplete: ${flag}`,
    );
  }
}

export function extractBackupRestoreSpec(config) {
  const postgres = config.services?.postgres;
  const app = config.services?.app;
  assert(postgres, "postgres service is missing");
  assert(app, "app service is missing");
  assert.match(
    postgres.image,
    /^postgres:18(?:[.-][\w.-]+)?(?:@sha256:[a-f0-9]{64})?$/,
  );

  const postgresMounts = postgres.volumes ?? [];
  assert.equal(
    postgresMounts.length,
    1,
    "Review backup rehearsal when PostgreSQL storage topology changes",
  );
  const pgMount = postgresMounts[0];
  assert.equal(pgMount.type, "volume");
  assert.equal(pgMount.source, "pgdata");
  assert(!pgMount.read_only, "PostgreSQL backup source must be writable");
  assert(
    ["/var/lib/postgresql", "/var/lib/postgresql/data"].includes(pgMount.target),
    "Unexpected PostgreSQL mount target",
  );

  const uploadMounts = (app.volumes ?? []).filter(
    (mount) => mount.target === "/data/uploads",
  );
  assert.equal(
    uploadMounts.length,
    1,
    "Exactly one application uploads mount is required",
  );
  const uploadMount = uploadMounts[0];
  assert.equal(uploadMount.type, "volume");
  assert.equal(uploadMount.source, "uploads");
  assert(!uploadMount.read_only, "Uploads backup source must be writable");

  return Object.freeze({
    postgresImage: postgres.image,
    postgresTarget: pgMount.target,
    uploadsTarget: uploadMount.target,
  });
}

export function makePostgresFixture(spec, imageId, volumeName, token) {
  return {
    services: {
      postgres: {
        image: imageId,
        network_mode: "none",
        restart: "no",
        environment: {
          POSTGRES_USER: "nexus_backup",
          POSTGRES_DB: "nexus_backup",
          POSTGRES_PASSWORD: token,
        },
        volumes: [
          {
            type: "volume",
            source: "pgdata",
            target: spec.postgresTarget,
          },
        ],
        healthcheck: {
          test: [
            "CMD",
            "pg_isready",
            "-h",
            "127.0.0.1",
            "-U",
            "nexus_backup",
            "-d",
            "nexus_backup",
          ],
          interval: "2s",
          timeout: "3s",
          retries: 30,
          start_period: "5s",
        },
      },
    },
    volumes: {
      pgdata: {
        external: true,
        name: volumeName,
      },
    },
  };
}

export function assertOwnedVolume(volume, expectedName, token) {
  assert(volume, "Volume inspection is missing");
  assert.equal(volume.Name, expectedName, "Unexpected volume name");
  assert.equal(
    volume.Labels?.[BACKUP_RESTORE_LABEL],
    token,
    "Volume ownership label mismatch",
  );
}
