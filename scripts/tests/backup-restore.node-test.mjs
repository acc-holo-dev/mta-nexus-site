import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BACKUP_RESTORE_LABEL,
  assertOwnedVolume,
  createPrivateBackupFile,
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
  assert.equal(fixture.services.postgres.environment.POSTGRES_PASSWORD, "synthetic-token");
  assert.equal(fixture.volumes.pgdata.name, "nexus-disposable-pgdata");
  assert.equal(fixture.volumes.pgdata.external, true);
  assert.equal(fixture.services.postgres.environment.DATABASE_URL, undefined);
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

test("reserves a private host-owned archive without overwriting existing data", () => {
  const root = mkdtempSync(join(tmpdir(), "nexus-backup-contract-"));
  const archive = join(root, "uploads.tar.gz");
  try {
    createPrivateBackupFile(archive);
    const info = statSync(archive);
    assert.equal(info.size, 0);
    if (process.platform !== "win32") {
      assert.equal(info.mode & 0o777, 0o600);
      assert.equal(info.uid, process.getuid());
    }
    writeFileSync(archive, "existing backup");
    assert.throws(() => createPrivateBackupFile(archive), { code: "EEXIST" });
    assert.equal(readFileSync(archive, "utf8"), "existing backup");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
