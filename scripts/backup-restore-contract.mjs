import assert from "node:assert/strict";

export const BACKUP_RESTORE_LABEL = "io.nexus.backup-restore-test";

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
