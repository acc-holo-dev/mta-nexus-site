import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = ["compose.yaml", "compose.production.yaml"];
const label = "io.nexus.persistence-test";

// Accept only the storage contract under test, never a runnable app configuration.
export function extractSpec(config) {
  const service = config.services?.postgres;
  assert(service, "postgres service is missing");
  assert.match(service.image, /^postgres:18(?:[.-][\w.-]+)?(?:@sha256:[a-f0-9]{64})?$/);
  assert.equal(service.volumes?.length, 1, "Review the test when storage topology changes");
  const mount = service.volumes[0];
  assert.equal(mount.type, "volume", "Only named-volume storage is covered");
  assert.equal(mount.source, "pgdata");
  assert(!mount.read_only, "Database volume must be writable");
  assert(["/var/lib/postgresql", "/var/lib/postgresql/data"].includes(mount.target));
  const pgdata = service.environment?.PGDATA;
  if (pgdata !== undefined) assert.equal(pgdata, "/var/lib/postgresql/18/docker");
  return { image: service.image, target: mount.target, pgdata };
}

export function makeFixture(spec, imageId, token) {
  return {
    services: {
      postgres: {
        image: imageId,
        network_mode: "none",
        restart: "no",
        labels: { [label]: token },
        environment: {
          POSTGRES_USER: "nexus_probe",
          POSTGRES_DB: "nexus_probe",
          POSTGRES_PASSWORD: token,
          ...(spec.pgdata === undefined ? {} : { PGDATA: spec.pgdata }),
        },
        volumes: [{ type: "volume", source: "pgdata", target: spec.target }],
        healthcheck: {
          // TCP is not served by the temporary initdb postmaster.
          test: ["CMD", "pg_isready", "-h", "127.0.0.1", "-U", "nexus_probe", "-d", "nexus_probe"],
          interval: "2s",
          timeout: "3s",
          retries: 30,
          start_period: "5s",
        },
      },
    },
    volumes: { pgdata: { labels: { [label]: token } } },
  };
}

export function assertNamedDataMount(mounts, dataDirectory, volumeName) {
  const covering = mounts
    .filter(
      (mount) =>
        dataDirectory === mount.Destination || dataDirectory.startsWith(`${mount.Destination}/`),
    )
    .sort((a, b) => b.Destination.length - a.Destination.length)[0];
  assert(covering, "No persistent mount covers data_directory");
  assert.equal(covering.Type, "volume");
  assert.equal(covering.Name, volumeName, "Database is not in the intended named volume");
  assert.equal(covering.RW, true, "Database volume is not writable");
}

function run() {
  const temp = mkdtempSync(join(tmpdir(), "nexus-pg-persistence-"));
  const emptyEnv = join(temp, "empty.env");
  writeFileSync(emptyEnv, "", { mode: 0o600 });
  // No application DATABASE_URL, .env, production credentials, or inherited Compose flags.
  const env = Object.fromEntries(
    [
      "PATH",
      "HOME",
      "USER",
      "TMPDIR",
      "DOCKER_HOST",
      "DOCKER_CONTEXT",
      "DOCKER_CONFIG",
      "DOCKER_TLS_VERIFY",
      "DOCKER_CERT_PATH",
      "XDG_RUNTIME_DIR",
      "SSL_CERT_FILE",
      "SSL_CERT_DIR",
    ]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  Object.assign(env, {
    COMPOSE_DISABLE_ENV_FILE: "true",
    DOMAIN: "persistence.invalid",
    ACME_EMAIL: "ci@persistence.invalid",
    AUTH_SECRET: "disposable-persistence-test-not-a-production-secret",
    TRUSTED_PROXY_SECRET: "disposable-persistence-proxy-config-only",
    POSTGRES_USER: "nexus_probe",
    POSTGRES_DB: "nexus_probe",
    POSTGRES_PASSWORD: "disposable-config-render-only",
  });
  function docker(args, timeout = 30_000) {
    try {
      return execFileSync("docker", args, {
        cwd: root,
        env,
        encoding: "utf8",
        timeout,
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch (error) {
      const detail = String(error.stderr || error.message).slice(-5000);
      throw new Error(`docker ${args[0]} failed: ${detail}`, { cause: error });
    }
  }
  const results = [];
  const images = new Map();
  try {
    console.log(docker(["version", "--format", "{{.Server.Version}}"]));
    console.log(docker(["compose", "version", "--short"]));
    for (const file of files) {
      const token = randomUUID();
      const project = `nexus-pg-test-${token}`;
      const volumeName = `${project}_pgdata`;
      const fixtureFile = join(temp, `${project}.json`);
      const compose = (...args) =>
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
          120_000,
        );
      const result = { file, status: "FAIL" };
      let ownsProject = false;
      try {
        const resolved = JSON.parse(
          docker([
            "compose",
            "--env-file",
            emptyEnv,
            "--project-name",
            project,
            "--file",
            join(root, file),
            "config",
            "--format",
            "json",
          ]),
        );
        const spec = extractSpec(resolved);
        result.target = spec.target;
        result.image = spec.image;
        if (!images.has(spec.image)) {
          docker(["pull", spec.image], 180_000);
          const info = JSON.parse(docker(["image", "inspect", spec.image]))[0];
          images.set(spec.image, { id: info.Id, digests: info.RepoDigests });
        }
        const image = images.get(spec.image);
        result.imageId = image.id;
        result.digests = image.digests;
        writeFileSync(fixtureFile, JSON.stringify(makeFixture(spec, image.id, token)), {
          mode: 0o600,
        });
        // Reject collisions before creating anything. Never adopt an existing volume.
        assert.equal(
          docker([
            "ps",
            "--all",
            "--quiet",
            "--filter",
            `label=com.docker.compose.project=${project}`,
          ]),
          "",
        );
        assert.equal(docker(["volume", "ls", "--quiet", "--filter", `name=^${volumeName}$`]), "");
        ownsProject = true;
        const start = () =>
          compose(
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
        const sql = (query) =>
          compose(
            "exec",
            "-T",
            "postgres",
            "psql",
            "-X",
            "-v",
            "ON_ERROR_STOP=1",
            "-U",
            "nexus_probe",
            "-d",
            "nexus_probe",
            "-Atc",
            query,
          );
        const snapshot = () => {
          const id = compose("ps", "--quiet", "postgres");
          assert.match(id, /^[a-f0-9]{64}$/);
          const mounts = JSON.parse(docker(["inspect", "--format", "{{json .Mounts}}", id]));
          const dataDirectory = sql("SHOW data_directory");
          assert.equal(dataDirectory, "/var/lib/postgresql/18/docker");
          assertNamedDataMount(mounts, dataDirectory, volumeName);
          const volume = JSON.parse(docker(["volume", "inspect", volumeName]))[0];
          assert.equal(volume.Labels?.[label], token, "Volume ownership label mismatch");
          return {
            id,
            dataDirectory,
            volume: volume.Name,
            systemIdentifier: sql("SELECT system_identifier::text FROM pg_control_system()"),
          };
        };
        start();
        result.version = sql("SHOW server_version");
        assert.match(result.version, /^18(?:\.|\s|$)/);
        result.before = snapshot();
        sql(`CREATE TABLE persistence_probe (id integer PRIMARY KEY, value text NOT NULL);
          INSERT INTO persistence_probe VALUES (1, '${token}');`);
        // Remove the container and its anonymous volumes, but KEEP the named volume.
        compose("rm", "--stop", "--force", "--volumes", "postgres");
        assert.equal(compose("ps", "--all", "--quiet", "postgres"), "");
        start();
        result.after = snapshot();
        assert.notEqual(result.after.id, result.before.id, "Container was not recreated");
        assert.equal(result.after.volume, result.before.volume);
        assert.equal(
          result.after.systemIdentifier,
          result.before.systemIdentifier,
          "Cluster was reinitialized",
        );
        assert.equal(
          sql("SELECT value FROM persistence_probe WHERE id = 1"),
          token,
          "Probe row was lost",
        );
        result.rowPreserved = true;
        result.status = "PASS";
      } catch (error) {
        result.error = error.message;
        if (ownsProject) {
          try {
            result.containerLog = compose("logs", "--no-color", "--tail", "40", "postgres");
          } catch (logError) {
            result.logError = logError.message;
          }
        }
      } finally {
        if (ownsProject) {
          try {
            // Only the generated fixture and UUID project are ever passed to destructive commands.
            compose("down", "--volumes", "--timeout", "10");
            assert.equal(
              docker(["volume", "ls", "--quiet", "--filter", `name=^${volumeName}$`]),
              "",
            );
            result.cleanedUp = true;
          } catch (error) {
            result.status = "FAIL";
            result.cleanupError = error.message;
          }
        }
        results.push(result);
        console.log(JSON.stringify(result, null, 2));
      }
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## PostgreSQL named-volume persistence\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\`\n`,
      );
    }
  }
  assert.equal(results.length, files.length);
  if (results.some((result) => result.status !== "PASS")) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
