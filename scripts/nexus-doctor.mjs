import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseVersion(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/u);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compareVersion(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function parseDevPort(value) {
  if (value === undefined || value === "") return 3000;
  if (!/^\d+$/u.test(value)) return null;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function safeCommandEnvironment(source = process.env) {
  const names = [
    "PATH",
    "Path",
    "HOME",
    "USERPROFILE",
    "SystemRoot",
    "SYSTEMROOT",
    "ComSpec",
    "PATHEXT",
    "TMPDIR",
    "TEMP",
    "TMP",
    "DOCKER_CONFIG",
    "XDG_CONFIG_HOME",
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "DOCKER_TLS_VERIFY",
    "DOCKER_CERT_PATH",
    "COMPOSE_DISABLE_ENV_FILE",
    "NEXUS_DEV_PORT",
  ];
  const safe = {};
  for (const name of names) {
    if (source[name] !== undefined) safe[name] = source[name];
  }
  return safe;
}

async function defaultRunCommand(command, args, options = {}) {
  const executable = process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
  try {
    const result = await execFileAsync(executable, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: safeCommandEnvironment(options.env ?? process.env),
      encoding: "utf8",
      timeout: options.timeout ?? 15_000,
      maxBuffer: 256 * 1024,
      windowsHide: true,
    });
    return { ok: true, stdout: result.stdout.trim() };
  } catch {
    return { ok: false, stdout: "" };
  }
}

async function defaultPathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function defaultProbePort(port) {
  return await new Promise((resolveProbe) => {
    const server = createServer();
    server.unref();
    server.once("error", (error) => {
      resolveProbe({
        available: false,
        code: typeof error === "object" && error && "code" in error ? error.code : "UNKNOWN",
      });
    });
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolveProbe({ available: true, code: null }));
    });
  });
}

function addCheck(checks, id, status, message, hint) {
  checks.push({ id, status, message, ...(hint ? { hint } : {}) });
}

export async function collectDoctor(options = {}) {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const pathExists = options.pathExists ?? defaultPathExists;
  const probePort = options.probePort ?? defaultProbePort;
  const env = options.env ?? process.env;
  const root = options.repositoryRoot ?? repositoryRoot;
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  const memoryBytes = options.memoryBytes ?? totalmem();

  const checks = [];
  const facts = {
    node: nodeVersion,
    nodePin: null,
    pnpm: null,
    docker: null,
    compose: null,
    dockerOs: null,
    dockerContext: null,
    devPort: null,
    memoryGiB: Number((memoryBytes / 1024 ** 3).toFixed(1)),
  };

  for (const relativePath of ["package.json", "pnpm-lock.yaml", "compose.yaml", "Dockerfile"]) {
    const present = await pathExists(resolve(root, relativePath));
    addCheck(
      checks,
      `file:${relativePath}`,
      present ? "pass" : "fail",
      present
        ? `Required project file is present: ${relativePath}`
        : `Required project file is missing: ${relativePath}`,
    );
  }

  let packageJson = {};
  try {
    packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  } catch {
    addCheck(
      checks,
      "package-json",
      "fail",
      "package.json could not be read as valid JSON.",
      "Restore a valid repository package.json before running host-side project commands.",
    );
  }

  let pinnedNode = "";
  try {
    const [nvmrc, nodeVersionFile] = await Promise.all([
      readFile(resolve(root, ".nvmrc"), "utf8"),
      readFile(resolve(root, ".node-version"), "utf8"),
    ]);
    const nvmPin = nvmrc.trim();
    const nodeVersionPin = nodeVersionFile.trim();
    if (!nvmPin || nvmPin !== nodeVersionPin || !parseVersion(nvmPin)) {
      addCheck(
        checks,
        "node-pin",
        "fail",
        "Repository Node version files are missing, invalid, or disagree.",
        "Keep .nvmrc and .node-version on the same valid Node release.",
      );
    } else {
      pinnedNode = nvmPin;
      facts.nodePin = pinnedNode;
      addCheck(checks, "node-pin", "pass", `Repository host Node pin: ${pinnedNode}.`);
    }
  } catch {
    addCheck(
      checks,
      "node-pin",
      "fail",
      "Repository Node version files could not be read.",
      "Restore .nvmrc and .node-version before using host-side tooling.",
    );
  }

  const nodeMajor = parseVersion(nodeVersion)?.[0] ?? 0;
  addCheck(
    checks,
    "node",
    nodeMajor >= 26 ? "pass" : "fail",
    `Node.js ${nodeVersion}; project requires Node.js 26 or newer for host-side tooling.`,
    nodeMajor >= 26
      ? undefined
      : pinnedNode
        ? `Use the repository Node ${pinnedNode} (for nvm: run \`nvm use\`) or the documented Docker-only startup.`
        : "Use Node.js 26+ or the documented Docker-only startup.",
  );

  const pnpmResult = await runCommand("pnpm", ["--version"], { cwd: root });
  const pinnedPnpm = String(packageJson.packageManager ?? "").replace(/^pnpm@/u, "");
  if (!pnpmResult.ok) {
    addCheck(
      checks,
      "pnpm",
      "warn",
      "pnpm is not available on the host.",
      "Docker-only local startup does not require host pnpm; install the pinned version only for host-side project commands.",
    );
  } else {
    facts.pnpm = pnpmResult.stdout;
    const pinned = Boolean(pinnedPnpm);
    const matchesPin = pinned && pnpmResult.stdout === pinnedPnpm;
    addCheck(
      checks,
      "pnpm",
      matchesPin ? "pass" : "warn",
      pinned
        ? `pnpm ${pnpmResult.stdout}; repository pins ${pinnedPnpm}.`
        : `pnpm ${pnpmResult.stdout}; repository packageManager pin is unavailable.`,
      matchesPin
        ? undefined
        : pinned
          ? `Use pnpm ${pinnedPnpm} for reproducible host-side commands; package.json#packageManager is authoritative.`
          : "Restore package.json before relying on host-side pnpm commands.",
    );
  }

  const dockerVersion = await runCommand("docker", ["version", "--format", "{{.Server.Version}}"], {
    cwd: root,
  });
  if (!dockerVersion.ok) {
    addCheck(
      checks,
      "docker",
      "fail",
      "Docker daemon is not reachable.",
      "Start Docker Engine or Docker Desktop with Linux containers.",
    );
  } else {
    facts.docker = dockerVersion.stdout;
    addCheck(checks, "docker", "pass", `Docker daemon reachable: ${dockerVersion.stdout}`);
  }

  const dockerOs = await runCommand("docker", ["info", "--format", "{{.OSType}}"], {
    cwd: root,
  });
  if (dockerOs.ok) {
    facts.dockerOs = dockerOs.stdout;
    addCheck(
      checks,
      "docker-os",
      dockerOs.stdout === "linux" ? "pass" : "fail",
      `Docker server OS: ${dockerOs.stdout || "unknown"}.`,
      dockerOs.stdout === "linux" ? undefined : "Switch Docker to Linux containers.",
    );
  } else if (dockerVersion.ok) {
    addCheck(checks, "docker-os", "fail", "Could not inspect Docker server OS.");
  }

  const composeVersion = await runCommand("docker", ["compose", "version", "--short"], {
    cwd: root,
  });
  if (!composeVersion.ok) {
    addCheck(
      checks,
      "compose",
      "fail",
      "Docker Compose v2 is unavailable.",
      "Install or enable the Docker Compose plugin.",
    );
  } else {
    facts.compose = composeVersion.stdout;
    const parsed = parseVersion(composeVersion.stdout);
    const minimum = [2, 24, 4];
    const supported = parsed && compareVersion(parsed, minimum) >= 0;
    addCheck(
      checks,
      "compose",
      supported ? "pass" : "warn",
      `Docker Compose ${composeVersion.stdout}; 2.24.4+ is expected by production CI overlays.`,
      supported ? undefined : "Upgrade the Compose plugin before production-rehearsal work.",
    );
  }

  const context = await runCommand("docker", ["context", "show"], { cwd: root });
  if (context.ok) {
    facts.dockerContext = context.stdout;
    const overridden = Boolean(env.DOCKER_HOST || env.DOCKER_CONTEXT);
    const nonDefault = context.stdout !== "default";
    addCheck(
      checks,
      "docker-context",
      overridden || nonDefault ? "warn" : "pass",
      overridden
        ? "A Docker host/context override is active."
        : `Docker context: ${context.stdout || "unknown"}.`,
      overridden || nonDefault
        ? "Production smoke scripts intentionally refuse remote/non-default daemons; verify the selected local Docker context before destructive disposable tests."
        : undefined,
    );
  }

  const port = parseDevPort(env.NEXUS_DEV_PORT);
  if (port === null) {
    addCheck(
      checks,
      "dev-port",
      "fail",
      "NEXUS_DEV_PORT is not a valid TCP port.",
      "Use an integer from 1 to 65535, or unset it to use 3000.",
    );
  } else {
    facts.devPort = port;
    const probe = await probePort(port);
    if (probe.available) {
      addCheck(checks, "dev-port", "pass", `127.0.0.1:${port} is available.`);
    } else if (probe.code === "EADDRINUSE") {
      addCheck(
        checks,
        "dev-port",
        "warn",
        `127.0.0.1:${port} is already in use.`,
        port === 3000
          ? "An existing NEXUS instance may already be running; otherwise set NEXUS_DEV_PORT=3001."
          : "An existing service may already be running; choose another NEXUS_DEV_PORT if needed.",
      );
    } else {
      addCheck(checks, "dev-port", "warn", `Could not verify availability of 127.0.0.1:${port}.`);
    }
  }

  if (dockerVersion.ok && composeVersion.ok && port !== null) {
    const composeEnv = {
      ...safeCommandEnvironment(env),
      COMPOSE_DISABLE_ENV_FILE: "true",
      NEXUS_DEV_PORT: String(port),
    };
    const composeConfig = await runCommand(
      "docker",
      ["compose", "-f", "compose.yaml", "config", "--quiet"],
      { cwd: root, env: composeEnv, timeout: 30_000 },
    );
    addCheck(
      checks,
      "compose-config",
      composeConfig.ok ? "pass" : "fail",
      composeConfig.ok
        ? "Local compose.yaml renders successfully without an implicit .env file."
        : "Local compose.yaml did not render successfully.",
      composeConfig.ok
        ? undefined
        : "Inspect compose.yaml and the selected NEXUS_DEV_PORT before starting containers.",
    );
  }

  if (facts.memoryGiB < 4) {
    addCheck(
      checks,
      "memory",
      "warn",
      `Host reports ${facts.memoryGiB} GiB RAM.`,
      "ClamAV alone is documented as memory-heavy; Docker may also have a lower memory limit than the host.",
    );
  } else {
    addCheck(
      checks,
      "memory",
      "pass",
      `Host reports ${facts.memoryGiB} GiB RAM; Docker's own memory allocation still needs separate verification.`,
    );
  }

  const hasFail = checks.some((check) => check.status === "fail");
  const hasWarn = checks.some((check) => check.status === "warn");
  return {
    status: hasFail ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    facts,
  };
}

export function formatDoctor(report) {
  const labels = { pass: "PASS", warn: "WARN", fail: "FAIL" };
  const lines = ["MTA NEXUS doctor", ""];
  for (const check of report.checks) {
    lines.push(`${labels[check.status]} [${check.id}] ${check.message}`);
    if (check.hint) lines.push(`  ${check.hint}`);
  }
  lines.push("", `Result: ${report.status.toUpperCase()}`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const report = await collectDoctor();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatDoctor(report));
  }
  if (report.status === "fail") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
