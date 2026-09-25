import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(
  root,
  process.env.NEXUS_EVIDENCE_OUTPUT_DIR ?? "artifacts/release-evidence",
);

const allowedGateStates = new Set([
  "success",
  "failure",
  "cancelled",
  "skipped",
  "not-recorded",
]);

function gateState(name) {
  const value = process.env[name] ?? "not-recorded";
  if (!allowedGateStates.has(value)) {
    throw new Error(
      `${name} must be one of: ${[...allowedGateStates].join(", ")}`,
    );
  }
  return value;
}

function gitValue(args, fallback = null) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function sha256(path) {
  const content = await readFile(join(root, path));
  return createHash("sha256").update(content).digest("hex");
}

const [packageJson, webPackageJson, migrationEntries, lockfileSha256] =
  await Promise.all([
    readJson("package.json"),
    readJson("apps/web/package.json"),
    readdir(join(root, "packages/db/migrations"), { withFileTypes: true }),
    sha256("pnpm-lock.yaml"),
  ]);

const migrations = migrationEntries
  .filter(
    (entry) =>
      entry.isFile() &&
      /^\d+.*\.sql$/u.test(entry.name),
  )
  .map((entry) => entry.name)
  .sort();

const gates = {
  verify: gateState("NEXUS_EVIDENCE_VERIFY"),
  accountBrowser: gateState("NEXUS_EVIDENCE_ACCOUNT_BROWSER"),
  directoryBrowser: gateState("NEXUS_EVIDENCE_DIRECTORY_BROWSER"),
  postgresPersistence: gateState("NEXUS_EVIDENCE_POSTGRES_PERSISTENCE"),
  localDockerStartup: gateState("NEXUS_EVIDENCE_LOCAL_DOCKER"),
  productionDockerStartup: gateState("NEXUS_EVIDENCE_PRODUCTION_DOCKER"),
};

const requiredGateNames = Object.keys(gates);
const recordedGateNames = requiredGateNames.filter(
  (name) => gates[name] !== "not-recorded",
);
const failedGateNames = requiredGateNames.filter(
  (name) => gates[name] === "failure" || gates[name] === "cancelled",
);
const allRequiredGatesRecorded =
  recordedGateNames.length === requiredGateNames.length;
const allRequiredGatesPassed =
  allRequiredGatesRecorded &&
  requiredGateNames.every((name) => gates[name] === "success");

const evidence = {
  schemaVersion: 1,
  kind: "mta-nexus-release-evidence",
  generatedAt: new Date().toISOString(),
  source: {
    commit:
      process.env.NEXUS_EVIDENCE_COMMIT ??
      process.env.GITHUB_SHA ??
      gitValue(["rev-parse", "HEAD"]),
    ref:
      process.env.NEXUS_EVIDENCE_REF ??
      process.env.GITHUB_REF_NAME ??
      gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  },
  toolchain: {
    node: process.version,
    packageManager: packageJson.packageManager ?? null,
    next: webPackageJson.dependencies?.next ?? null,
    react: webPackageJson.dependencies?.react ?? null,
    typescript: packageJson.devDependencies?.typescript ?? null,
    vitest: packageJson.devDependencies?.vitest ?? null,
  },
  repository: {
    lockfileSha256,
    migrations: {
      count: migrations.length,
      latest: migrations.at(-1) ?? null,
      files: migrations,
    },
  },
  gates,
  summary: {
    requiredGateNames,
    recordedGateNames,
    failedGateNames,
    allRequiredGatesRecorded,
    allRequiredGatesPassed,
  },
  artifacts: {
    productionImageDigest:
      process.env.NEXUS_EVIDENCE_PRODUCTION_IMAGE_DIGEST ?? null,
  },
  releaseDecision: "not-recorded",
  limitations: [
    "This file records supplied evidence; it does not execute the release gates.",
    "A successful gate result applies only to the commit and environment that produced it.",
    "Release approval, deployment approval and production deployment are separate decisions.",
  ],
};

await mkdir(outputDir, { recursive: true });

const jsonPath = join(outputDir, "release-evidence.json");
const markdownPath = join(outputDir, "release-evidence.md");

await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);

const gateRows = Object.entries(gates)
  .map(([name, status]) => `| ${name} | ${status} |`)
  .join("\n");

const markdown = `# MTA NEXUS release evidence

Generated: ${evidence.generatedAt}

Commit: ${evidence.source.commit ?? "unknown"}
Ref: ${evidence.source.ref ?? "unknown"}
Release decision: **not recorded**

## Recorded gates

| Gate | Status |
|---|---|
${gateRows}

All required gates recorded: ${allRequiredGatesRecorded ? "yes" : "no"}
All required gates passed: ${allRequiredGatesPassed ? "yes" : "no"}

## Build identity

- Node: ${evidence.toolchain.node}
- Package manager: ${evidence.toolchain.packageManager ?? "unknown"}
- Next.js: ${evidence.toolchain.next ?? "unknown"}
- React: ${evidence.toolchain.react ?? "unknown"}
- TypeScript: ${evidence.toolchain.typescript ?? "unknown"}
- Vitest: ${evidence.toolchain.vitest ?? "unknown"}
- pnpm-lock SHA-256: ${lockfileSha256}
- Latest migration: ${evidence.repository.migrations.latest ?? "none"}
- Production image digest: ${evidence.artifacts.productionImageDigest ?? "not recorded"}

## Limitations

${evidence.limitations.map((item) => `- ${item}`).join("\n")}
`;

await writeFile(markdownPath, markdown);

console.log(
  JSON.stringify({
    status: "ok",
    jsonPath,
    markdownPath,
    allRequiredGatesRecorded,
    allRequiredGatesPassed,
    releaseDecision: evidence.releaseDecision,
  }),
);
