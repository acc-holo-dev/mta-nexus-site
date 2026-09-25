import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectDoctor, formatDoctor } from "../nexus-doctor.mjs";

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), "nexus-doctor-"));
  await Promise.all([
    writeFile(join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@12.4.2" })),
    writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n"),
    writeFile(join(root, "compose.yaml"), "services: {}\n"),
    writeFile(join(root, "Dockerfile"), "FROM scratch\n"),
  ]);
  return root;
}

function commandRunner(values) {
  return async (command, args) => {
    const key = [command, ...args].join(" ");
    return values[key] ?? { ok: false, stdout: "" };
  };
}

test("healthy local prerequisites produce a passing report", async () => {
  const root = await fixtureRoot();
  try {
    const report = await collectDoctor({
      repositoryRoot: root,
      nodeVersion: "26.6.1",
      memoryBytes: 8 * 1024 ** 3,
      env: {},
      pathExists: async () => true,
      probePort: async () => ({ available: true, code: null }),
      runCommand: commandRunner({
        "pnpm --version": { ok: true, stdout: "12.4.2" },
        "docker version --format {{.Server.Version}}": { ok: true, stdout: "29.0.0" },
        "docker info --format {{.OSType}}": { ok: true, stdout: "linux" },
        "docker compose version --short": { ok: true, stdout: "2.40.0" },
        "docker context show": { ok: true, stdout: "default" },
        "docker compose -f compose.yaml config --quiet": { ok: true, stdout: "" },
      }),
    });

    assert.equal(report.status, "pass");
    assert(report.checks.every((check) => check.status === "pass"));
    assert.match(formatDoctor(report), /Result: PASS/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing Docker is a failure but unavailable host pnpm is only a warning", async () => {
  const root = await fixtureRoot();
  try {
    const report = await collectDoctor({
      repositoryRoot: root,
      nodeVersion: "26.0.0",
      memoryBytes: 8 * 1024 ** 3,
      env: {},
      pathExists: async () => true,
      probePort: async () => ({ available: true, code: null }),
      runCommand: commandRunner({
        "docker context show": { ok: false, stdout: "" },
      }),
    });

    assert.equal(report.status, "fail");
    assert.equal(report.checks.find((check) => check.id === "pnpm")?.status, "warn");
    assert.equal(report.checks.find((check) => check.id === "docker")?.status, "fail");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("occupied port and non-default Docker context remain warnings", async () => {
  const root = await fixtureRoot();
  try {
    const report = await collectDoctor({
      repositoryRoot: root,
      nodeVersion: "26.1.0",
      memoryBytes: 8 * 1024 ** 3,
      env: { NEXUS_DEV_PORT: "3000" },
      pathExists: async () => true,
      probePort: async () => ({ available: false, code: "EADDRINUSE" }),
      runCommand: commandRunner({
        "pnpm --version": { ok: true, stdout: "12.4.2" },
        "docker version --format {{.Server.Version}}": { ok: true, stdout: "29.0.0" },
        "docker info --format {{.OSType}}": { ok: true, stdout: "linux" },
        "docker compose version --short": { ok: true, stdout: "2.40.0" },
        "docker context show": { ok: true, stdout: "desktop-linux" },
        "docker compose -f compose.yaml config --quiet": { ok: true, stdout: "" },
      }),
    });

    assert.equal(report.status, "warn");
    assert.equal(report.checks.find((check) => check.id === "dev-port")?.status, "warn");
    assert.equal(report.checks.find((check) => check.id === "docker-context")?.status, "warn");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid NEXUS_DEV_PORT fails without probing an arbitrary port", async () => {
  const root = await fixtureRoot();
  let probes = 0;
  try {
    const report = await collectDoctor({
      repositoryRoot: root,
      nodeVersion: "26.1.0",
      memoryBytes: 8 * 1024 ** 3,
      env: { NEXUS_DEV_PORT: "not-a-port" },
      pathExists: async () => true,
      probePort: async () => {
        probes += 1;
        return { available: true, code: null };
      },
      runCommand: commandRunner({
        "pnpm --version": { ok: true, stdout: "12.4.2" },
        "docker version --format {{.Server.Version}}": { ok: true, stdout: "29.0.0" },
        "docker info --format {{.OSType}}": { ok: true, stdout: "linux" },
        "docker compose version --short": { ok: true, stdout: "2.40.0" },
        "docker context show": { ok: true, stdout: "default" },
      }),
    });

    assert.equal(report.status, "fail");
    assert.equal(probes, 0);
    assert.equal(report.checks.find((check) => check.id === "dev-port")?.status, "fail");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("compose validation does not forward application secrets", async () => {
  const root = await fixtureRoot();
  let composeEnvironment;
  const values = {
    "pnpm --version": { ok: true, stdout: "12.4.2" },
    "docker version --format {{.Server.Version}}": { ok: true, stdout: "29.0.0" },
    "docker info --format {{.OSType}}": { ok: true, stdout: "linux" },
    "docker compose version --short": { ok: true, stdout: "2.40.0" },
    "docker context show": { ok: true, stdout: "default" },
    "docker compose -f compose.yaml config --quiet": { ok: true, stdout: "" },
  };

  try {
    await collectDoctor({
      repositoryRoot: root,
      nodeVersion: "26.1.0",
      memoryBytes: 8 * 1024 ** 3,
      env: {
        PATH: "/usr/bin:/bin",
        HOME: "/tmp/nexus-doctor-home",
        NEXUS_DEV_PORT: "3001",
        AUTH_SECRET: "must-not-be-forwarded",
        DATABASE_URL: "must-not-be-forwarded",
        ACCOUNT_MAIL_KEY: "must-not-be-forwarded",
      },
      pathExists: async () => true,
      probePort: async () => ({ available: true, code: null }),
      runCommand: async (command, args, options = {}) => {
        const key = [command, ...args].join(" ");
        if (key === "docker compose -f compose.yaml config --quiet") {
          composeEnvironment = options.env;
        }
        return values[key] ?? { ok: false, stdout: "" };
      },
    });

    assert.equal(composeEnvironment.NEXUS_DEV_PORT, "3001");
    assert.equal(composeEnvironment.COMPOSE_DISABLE_ENV_FILE, "true");
    assert.equal(composeEnvironment.AUTH_SECRET, undefined);
    assert.equal(composeEnvironment.DATABASE_URL, undefined);
    assert.equal(composeEnvironment.ACCOUNT_MAIL_KEY, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
