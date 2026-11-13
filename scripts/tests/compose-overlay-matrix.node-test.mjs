import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createBackupRestoreEnvironment } from "../backup-restore-contract.mjs";
import {
  PRODUCTION_BASE_SERVICES,
  PRODUCTION_BASE_WRITERS,
  SUPPORTED_COMPOSE_SCENARIOS,
} from "./compose-overlay-matrix-lib.mjs";

const root = process.cwd();

function syntheticEnv(extra = {}) {
  return {
    ...createBackupRestoreEnvironment({
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
    }),
    NEXUS_MAIL_IMAGE: "mta-nexus:ops-matrix-test",
    NEXUS_CI_IMAGE: "mta-nexus:ops-matrix-test",
    NEXUS_CI_ACCOUNT_MAIL_KEY: "dGVzdC1jaS1hY2NvdW50LW1haWwta2V5LTMyYnl0ZXMhISE",
    NEXUS_CI_ACCOUNT_RECOVERY_ABUSE_KEY: "dGVzdC1jaS1yZWNvdmVyeS1hYnVzZS1rZXktMzJieXRlcw",
    NEXUS_CI_CADDYFILE: resolve(root, "deploy/Caddyfile"),
    ACCOUNT_MAIL_KEY_ID: "ci",
    ACCOUNT_MAIL_KEY: "dGVzdC1hY2NvdW50LW1haWwta2V5LWZvci1tYXRyaXgtes",
    ACCOUNT_RECOVERY_ABUSE_KEY: "dGVzdC1yZWNvdmVyeS1hYnVzZS1rZXktbWF0cml4LXRlc3Q",
    ACCOUNT_MAIL_APP_URL: "https://nexus-ci.test",
    ACCOUNT_MAIL_SMTP_HOST: "smtp.invalid",
    ACCOUNT_MAIL_SMTP_SERVERNAME: "smtp.invalid",
    ACCOUNT_MAIL_SMTP_FROM: "no-reply@nexus-ci.test",
    ACCOUNT_MAIL_PREVIOUS_KEY_ID: "ci-previous",
    ACCOUNT_MAIL_PREVIOUS_KEY: "dGVzdC1wcmV2aW91cy1tYWlsLWtleS1mb3ItbWF0cml4LXQ",
    ACCOUNT_MAIL_SMTP_USERNAME: "nexus-ci-user",
    ACCOUNT_MAIL_SMTP_PASSWORD: "nexus-ci-password",
    ...extra,
  };
}

function renderCompose(files, env, projectName) {
  const directory = mkdtempSync(join(tmpdir(), "nexus-compose-matrix-"));
  const emptyEnv = join(directory, "empty.env");
  try {
    writeFileSync(emptyEnv, "", { mode: 0o600 });
    const args = ["compose", "--env-file", emptyEnv, "--project-name", projectName];
    for (const file of files) {
      args.push("--file", resolve(root, file));
    }
    args.push("config", "--format", "json");
    const rendered = execFileSync("docker", args, {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return JSON.parse(rendered);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function sourceBindMounts(service) {
  return (service.volumes || []).filter(
    (mount) =>
      mount.type === "bind" &&
      typeof mount.source === "string" &&
      /(?:^|\/)(?:apps|packages|site\/(?:src|packages))(?:\/|$)/u.test(
        mount.source.replaceAll("\\", "/"),
      ),
  );
}

test("production mount guard recognizes legacy and nested source layouts", () => {
  const sources = [
    "./apps/web/src",
    "/checkout/packages/db/src",
    "./site/src",
    "/checkout/site/src/app",
    "site/packages/ui/src",
    "C:\\checkout\\site\\packages\\db\\src",
  ];
  const volumes = sources.map((source) => ({ type: "bind", source }));
  assert.deepEqual(sourceBindMounts({ volumes }), volumes);
  assert.deepEqual(
    sourceBindMounts({
      volumes: [
        { type: "volume", source: "uploads" },
        { type: "bind", source: "/data/uploads" },
        { type: "bind", source: "/run/secrets/mail-key" },
      ],
    }),
    [],
  );
});

test("OPERATIONS documents the supported Compose overlay matrix and writer inventory", () => {
  const ops = readFileSync(resolve(root, "docs/OPERATIONS.md"), "utf8");
  assert.match(ops, /### Compose overlay matrix/u);
  assert.match(ops, /compose\.yaml/u);
  assert.match(ops, /compose\.verify\.yaml/u);
  assert.match(ops, /compose\.production\.yaml/u);
  assert.match(ops, /compose\.production-ci\.yaml/u);
  assert.match(ops, /compose\.recovery\.yaml/u);
  assert.match(ops, /compose\.mail-worker\.yaml/u);
  assert.match(ops, /dc stop caddy push-worker license-worker resource-release-worker app/u);
  assert.match(
    ops,
    /dc up --detach --no-build --pull never --wait --wait-timeout 300 \\\s*\n\s*push-worker license-worker resource-release-worker/u,
  );
  assert.match(ops, /mail-worker/u);
  assert.match(ops, /PostgreSQL stays up for pg_dump|Keep PostgreSQL running|postgres.*dump/iu);
  assert.doesNotMatch(ops, /dc stop caddy push-worker app\n(?!#)/u);
});

test("OPERATIONS documents the guarded custom migration authoring path", () => {
  const ops = readFileSync(resolve(root, "docs/OPERATIONS.md"), "utf8");
  assert.match(ops, /### Forward-only migration authoring/u);
  assert.match(ops, /generate:custom/u);
  assert.match(ops, /guard-db-generate\.mjs/u);
  assert.match(ops, /ARCHITECTURE\.md/u);
  assert.match(ops, /NEXUS_ALLOW_DB_GENERATE=1/u);
  assert.match(ops, /do not run generate|Refusing plain|unsafe in the main checkout/iu);
});

test("db generate scripts stay guarded while snapshots lag the journal", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "site/packages/db/package.json"), "utf8"));
  assert.equal(pkg.scripts.generate, "node scripts/guard-db-generate.mjs");
  assert.equal(pkg.scripts["generate:custom"], "node scripts/guard-db-generate.mjs --custom");
  const guard = readFileSync(
    resolve(root, "site/packages/db/scripts/guard-db-generate.mjs"),
    "utf8",
  );
  assert.match(guard, /NEXUS_ALLOW_DB_GENERATE/u);
  assert.match(guard, /NEXUS_ALLOW_UNSAFE_DB_GENERATE/u);
  assert.match(guard, /--custom/u);

  const journal = JSON.parse(
    readFileSync(resolve(root, "site/packages/db/migrations/meta/_journal.json"), "utf8"),
  );
  const snapshots = ["0000_snapshot.json", "0001_snapshot.json"].map((name) =>
    resolve(root, "site/packages/db/migrations/meta", name),
  );
  for (const path of snapshots) assert.equal(readFileSync(path, "utf8").length > 0, true);
  assert.ok(journal.entries.length > 2, "journal must advance past early snapshots");
  assert.equal(
    journal.entries.at(-1)?.tag?.startsWith("000"),
    false,
    "latest journal tag must outpace 0000/0001 snapshots",
  );
});

test("plain generate exits non-zero without unsafe opt-in", () => {
  let status = 0;
  let stderr = "";
  try {
    execFileSync(
      process.execPath,
      [resolve(root, "site/packages/db/scripts/guard-db-generate.mjs")],
      {
        cwd: resolve(root, "site/packages/db"),
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          NEXUS_ALLOW_DB_GENERATE: "",
          NEXUS_ALLOW_UNSAFE_DB_GENERATE: "",
        },
      },
    );
  } catch (error) {
    status = error.status;
    stderr = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.notEqual(status, 0);
  assert.match(stderr, /Refusing plain drizzle-kit generate/u);
  assert.match(stderr, /generate:custom/u);
});

test("custom generate exits non-zero without NEXUS_ALLOW_DB_GENERATE", () => {
  let status = 0;
  let stderr = "";
  try {
    execFileSync(
      process.execPath,
      [resolve(root, "site/packages/db/scripts/guard-db-generate.mjs"), "--custom"],
      {
        cwd: resolve(root, "site/packages/db"),
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          NEXUS_ALLOW_DB_GENERATE: "",
          NEXUS_ALLOW_UNSAFE_DB_GENERATE: "",
        },
      },
    );
  } catch (error) {
    status = error.status;
    stderr = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  assert.notEqual(status, 0);
  assert.match(stderr, /Refusing generate:custom/u);
});

test("supported Compose scenarios render predictable service inventories", () => {
  for (const scenario of SUPPORTED_COMPOSE_SCENARIOS) {
    const config = renderCompose(scenario.files, syntheticEnv(), `nexus-ops-matrix-${scenario.id}`);
    assert.deepEqual(
      Object.keys(config.services).sort(),
      [...scenario.services].sort(),
      `unexpected services for ${scenario.id}`,
    );
  }
});

test("production config has no development source mounts", () => {
  const config = renderCompose(
    ["deploy/compose.production.yaml"],
    syntheticEnv(),
    "nexus-ops-matrix-prod-mounts",
  );
  for (const [name, service] of Object.entries(config.services)) {
    const mounts = sourceBindMounts(service);
    assert.deepEqual(mounts, [], `${name} must not bind-mount apps/packages sources`);
  }
  const appVolumes = config.services.app.volumes || [];
  assert.ok(
    appVolumes.some((mount) => mount.type === "volume" && mount.target === "/data/uploads"),
    "app must keep the uploads volume",
  );
});

test("production CI publishes only loopback ports and keeps the writer inventory", () => {
  const config = renderCompose(
    ["deploy/compose.production.yaml", "deploy/compose.production-ci.yaml"],
    syntheticEnv(),
    "nexus-ops-matrix-ci",
  );
  assert.deepEqual(Object.keys(config.services).sort(), [...PRODUCTION_BASE_SERVICES].sort());
  for (const name of PRODUCTION_BASE_WRITERS) {
    assert.ok(config.services[name], `missing writer ${name}`);
  }
  for (const [name, service] of Object.entries(config.services)) {
    for (const port of service.ports || []) {
      const published = String(port.published ?? port.host_ip ?? "");
      const hostIp = port.host_ip ?? port.HostIP;
      if (name === "caddy") {
        assert.ok(
          hostIp === "127.0.0.1" || String(port).includes("127.0.0.1"),
          `CI caddy port must be loopback: ${JSON.stringify(port)}`,
        );
      } else {
        assert.fail(`${name} must not publish ports in CI: ${JSON.stringify(port)} / ${published}`);
      }
    }
    if (name !== "caddy") {
      assert.equal(service.ports?.length || 0, 0, `${name} must not publish host ports`);
    }
  }
  const caddyPorts = config.services.caddy.ports || [];
  assert.ok(caddyPorts.length >= 2, "CI caddy must publish HTTP and HTTPS loopback ports");
  for (const port of caddyPorts) {
    assert.equal(port.host_ip ?? port.HostIP, "127.0.0.1");
  }
});

test("production recovery+mail overlay adds mail-worker without dropping base writers", () => {
  const config = renderCompose(
    [
      "deploy/compose.production.yaml",
      "deploy/compose.recovery.yaml",
      "deploy/compose.mail-worker.yaml",
    ],
    syntheticEnv(),
    "nexus-ops-matrix-mail",
  );
  for (const name of PRODUCTION_BASE_WRITERS) {
    assert.ok(config.services[name], `missing base writer ${name}`);
  }
  assert.ok(config.services["mail-worker"], "mail-worker missing");
  assert.equal(config.services.app.environment?.ACCOUNT_MAIL_KEY_ID, "ci");
  assert.equal(config.services["mail-worker"].environment?.NODE_ENV, "production");
  assert.deepEqual(config.services["mail-worker"].ports ?? [], []);
});
