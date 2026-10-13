import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const recoveryDatabaseTests = [
  "tests/notification-inbox-history.integration.test.ts",
  "tests/discussion-watch-persistence.integration.test.ts",
  "tests/discovery-follow-persistence.integration.test.ts",
  "tests/notification-preference-serialization.integration.test.ts",
  "tests/web-push-outbox.integration.test.ts",
  "tests/web-push-outbox-capacity.integration.test.ts",
  "tests/web-push-worker.integration.test.ts",
  "tests/web-push-worker-concurrency.integration.test.ts",
];

export function validateRecoveryDatabaseEnvironment(env) {
  if (env.NODE_ENV !== "test" || env.NEXUS_DISCUSSION_RECOVERY_DB_ACK !== "disposable")
    throw Error("Explicit disposable test database acknowledgement is required");
  let target;
  try {
    target = new URL(env.DATABASE_URL);
  } catch {
    throw Error("Invalid test database configuration");
  }
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    target.search ||
    target.hash ||
    !target.username ||
    !/^\/(mta_nexus_recovery|nexus_recovery_[a-z0-9]{8,32})$/.test(target.pathname)
  )
    throw Error("Recovery verification requires a named loopback disposable database");
  return target.pathname.slice(1);
}
export function validateRecoveryDatabaseMetadata(row, expectedDatabase) {
  if (
    !row ||
    row.databaseName !== expectedDatabase ||
    !/^18\d{4}$/.test(String(row.serverVersionNum)) ||
    row.tables !== 0
  )
    throw Error("Recovery verification requires an empty PostgreSQL 18 database");
  return Number(row.serverVersionNum);
}
export function recoveryTestCounts(report) {
  if (
    report?.success !== true ||
    !Number.isSafeInteger(report.numTotalTests) ||
    report.numTotalTests < 1 ||
    report.numFailedTests !== 0 ||
    report.numPassedTests !== report.numTotalTests ||
    !Array.isArray(report.testResults) ||
    report.testResults.length !== recoveryDatabaseTests.length ||
    report.testResults.some(
      (file) =>
        file.status !== "passed" ||
        !file.assertionResults?.length ||
        file.assertionResults.some((assertion) => assertion.status !== "passed"),
    ) ||
    report.testResults.reduce((sum, file) => sum + file.assertionResults.length, 0) !==
      report.numTotalTests ||
    recoveryDatabaseTests.some(
      (name) =>
        report.testResults.filter(
          (file) => file.name === name || file.name?.replaceAll("\\", "/").endsWith(`/${name}`),
        ).length !== 1,
    )
  )
    throw Error("Recovery database tests did not produce complete passing evidence");
  return { tests: report.numPassedTests, files: report.testResults.length };
}
async function migrationDigest() {
  const folder = resolve(root, "packages/db/migrations");
  const journal = await readFile(resolve(folder, "meta/_journal.json"), "utf8");
  const hash = createHash("sha256").update(journal);
  for (const entry of JSON.parse(journal).entries)
    hash.update(entry.tag).update(await readFile(resolve(folder, `${entry.tag}.sql`)));
  return hash.digest("hex");
}
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) throw Error("Recovery verification command failed");
}
export async function verifyDiscussionRecovery() {
  const artifacts = resolve(root, "artifacts");
  await mkdir(artifacts, { recursive: true });
  const output = resolve(artifacts, "discussion-recovery.json");
  const reportPath = resolve(artifacts, "discussion-recovery-tests.json");
  // A prior successful run cannot stand in for a failed/missing report in this run.
  await writeFile(reportPath, "null\n");
  const evidence = {
    version: 1,
    status: "failed",
    stage: "environment-preflight",
    sha: null,
    migrationDigest: null,
    node: process.versions.node,
    startedAt: new Date().toISOString(),
    serverVersionNum: null,
    tests: 0,
    files: 0,
  };
  const save = () => writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  await save();
  try {
    const databaseName = validateRecoveryDatabaseEnvironment(process.env);
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    if (
      !/^[a-f0-9]{40}$/.test(sha) ||
      dirty ||
      (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha)
    )
      throw Error("Recovery evidence requires a clean exact commit");
    evidence.sha = sha;
    evidence.migrationDigest = await migrationDigest();
    evidence.stage = "database-preflight";
    await save();
    const require = createRequire(resolve(root, "packages/db/package.json"));
    const postgres = require("postgres");
    const client = postgres(process.env.DATABASE_URL, {
      max: 1,
      connect_timeout: 10,
      idle_timeout: 1,
    });
    try {
      const [metadata] = await client`select current_database() as "databaseName",
        current_setting('server_version_num') as "serverVersionNum",
        (select count(*)::integer from pg_catalog.pg_tables where schemaname !~ '^pg_' and schemaname <> 'information_schema') as tables`;
      evidence.serverVersionNum = validateRecoveryDatabaseMetadata(metadata, databaseName);
    } finally {
      await client.end({ timeout: 5 });
    }
    evidence.stage = "migrations";
    await save();
    run(["--import", "tsx", "packages/db/src/migrate.ts"]);
    evidence.stage = "database-tests";
    await save();
    run([
      "node_modules/vitest/vitest.mjs",
      "run",
      "--project",
      "database",
      ...recoveryDatabaseTests,
      "--reporter=default",
      "--reporter=json",
      `--outputFile=${reportPath}`,
    ]);
    const counts = recoveryTestCounts(JSON.parse(await readFile(reportPath, "utf8")));
    Object.assign(evidence, counts, {
      status: "passed",
      stage: "completed",
      completedAt: new Date().toISOString(),
    });
  } finally {
    await save();
  }
  return evidence;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await verifyDiscussionRecovery()));
  } catch {
    console.error(
      "Discussion recovery verification failed; inspect exact-SHA evidence and test output.",
    );
    process.exitCode = 1;
  }
}
