import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_RESTORE_LABEL,
  assertOwnedVolume,
  extractBackupRestoreSpec,
  makePostgresFixture,
} from "../backup-restore-contract.mjs";

function config() {
  return {
    services: {
      postgres: {
        image: "postgres:18-alpine",
        volumes: [
          {
            type: "volume",
            source: "pgdata",
            target: "/var/lib/postgresql",
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
  };
}

test("extracts only the production database and uploads storage contract", () => {
  assert.deepEqual(extractBackupRestoreSpec(config()), {
    postgresImage: "postgres:18-alpine",
    postgresTarget: "/var/lib/postgresql",
    uploadsTarget: "/data/uploads",
  });
});

test("rejects bind mounts, missing uploads and unreviewed PostgreSQL images", () => {
  const bind = config();
  bind.services.postgres.volumes[0].type = "bind";
  assert.throws(() => extractBackupRestoreSpec(bind));

  const noUploads = config();
  noUploads.services.app.volumes = [];
  assert.throws(() => extractBackupRestoreSpec(noUploads));

  const oldPostgres = config();
  oldPostgres.services.postgres.image = "postgres:17-alpine";
  assert.throws(() => extractBackupRestoreSpec(oldPostgres));
});

test("fixture receives only disposable database settings and an external owned volume", () => {
  const fixture = makePostgresFixture(
    extractBackupRestoreSpec(config()),
    "sha256:test-image",
    "nexus-disposable-pgdata",
    "synthetic-token",
  );

  assert.deepEqual(Object.keys(fixture.services), ["postgres"]);
  assert.equal(fixture.services.postgres.network_mode, "none");
  assert.equal(
    fixture.services.postgres.environment.POSTGRES_PASSWORD,
    "synthetic-token",
  );
  assert.equal(
    fixture.volumes.pgdata.name,
    "nexus-disposable-pgdata",
  );
  assert.equal(fixture.volumes.pgdata.external, true);
  assert.equal(
    fixture.services.postgres.environment.DATABASE_URL,
    undefined,
  );
});

test("destructive cleanup ownership requires the exact label and volume name", () => {
  assert.doesNotThrow(() =>
    assertOwnedVolume(
      {
        Name: "owned-volume",
        Labels: { [BACKUP_RESTORE_LABEL]: "token" },
      },
      "owned-volume",
      "token",
    ),
  );
  assert.throws(() =>
    assertOwnedVolume(
      {
        Name: "other-volume",
        Labels: { [BACKUP_RESTORE_LABEL]: "token" },
      },
      "owned-volume",
      "token",
    ),
  );
  assert.throws(() =>
    assertOwnedVolume(
      {
        Name: "owned-volume",
        Labels: { [BACKUP_RESTORE_LABEL]: "other-token" },
      },
      "owned-volume",
      "token",
    ),
  );
});

test("uploads archive is host-owned before container tar opens it", async () => {
  const { readFile } = await import("node:fs/promises");
  const script = await readFile(new URL("../check-backup-restore.mjs", import.meta.url), "utf8");
  const create = script.indexOf('writeFileSync(uploadsBackup, Buffer.alloc(0), { flag: "wx", mode: 0o600 })');
  assert.ok(create > 0);
  assert.ok(create < script.indexOf('tar -C /data -czf /backup/uploads.tar.gz'));
});
