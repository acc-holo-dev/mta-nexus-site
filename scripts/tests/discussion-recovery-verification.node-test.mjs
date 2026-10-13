import assert from "node:assert/strict";
import test from "node:test";
import {
  validateRecoveryDatabaseEnvironment as environment,
  validateRecoveryDatabaseMetadata as metadata,
  recoveryDatabaseTests,
  recoveryTestCounts,
} from "../verify-discussion-recovery.mjs";

const env = {
  NODE_ENV: "test",
  NEXUS_DISCUSSION_RECOVERY_DB_ACK: "disposable",
  DATABASE_URL: "postgres://nexus:PRIVATE_VALUE@127.0.0.1:5432/mta_nexus_recovery",
};
test("accepts only an explicit loopback disposable target before loading a database driver", () => {
  assert.equal(environment(env), "mta_nexus_recovery");
  assert.equal(
    environment({ ...env, DATABASE_URL: "postgresql://nexus@localhost/nexus_recovery_12345678" }),
    "nexus_recovery_12345678",
  );
  assert.equal(
    environment({ ...env, DATABASE_URL: "postgresql://nexus@[::1]/mta_nexus_recovery" }),
    "mta_nexus_recovery",
  );
});
test("rejects live/default/remote/ambiguous destinations and does not print credentials", () => {
  for (const overrides of [
    { NODE_ENV: "production" },
    { NEXUS_DISCUSSION_RECOVERY_DB_ACK: "" },
    { DATABASE_URL: undefined },
    { DATABASE_URL: "postgres://nexus:PRIVATE_VALUE@127.0.0.1/mta_nexus" },
    { DATABASE_URL: "postgres://nexus:PRIVATE_VALUE@remote.example/mta_nexus_recovery" },
    { DATABASE_URL: "postgres://nexus:PRIVATE_VALUE@localhost/mta_nexus_recovery?options=x" },
  ]) {
    assert.throws(
      () => environment({ ...env, ...overrides }),
      (error) => !error.message.includes("PRIVATE_VALUE"),
    );
  }
});
test("actual database name, version and emptiness must match before migration", () => {
  const row = { databaseName: "mta_nexus_recovery", serverVersionNum: "180004", tables: 0 };
  assert.equal(metadata(row, row.databaseName), 180004);
  for (const value of [
    null,
    { ...row, databaseName: "mta_nexus" },
    { ...row, serverVersionNum: "170004" },
    { ...row, serverVersionNum: "190000" },
    { ...row, tables: 1 },
    { ...row, tables: null },
    { ...row, tables: undefined },
  ])
    assert.throws(() => metadata(value, row.databaseName));
});
test("missing, stale, skipped or failed test evidence cannot pass verification", () => {
  const count = recoveryDatabaseTests.length;
  const report = {
    success: true,
    numTotalTests: count,
    numPassedTests: count,
    numFailedTests: 0,
    testResults: recoveryDatabaseTests.map((name) => ({
      name,
      status: "passed",
      assertionResults: [{ status: "passed" }],
    })),
  };
  assert.deepEqual(recoveryTestCounts(report), {
    tests: count,
    files: recoveryDatabaseTests.length,
  });
  for (const value of [
    null,
    { ...report, success: false },
    { ...report, numPassedTests: 19 },
    { ...report, numFailedTests: 1 },
    { ...report, testResults: [] },
    {
      ...report,
      testResults: report.testResults.map((file) => ({ ...file, name: "unrelated.test.ts" })),
    },
    {
      ...report,
      testResults: report.testResults.map((file) => ({
        ...file,
        assertionResults: [{ status: "pending" }],
      })),
    },
    {
      ...report,
      testResults: report.testResults.map((file) => ({ ...file, assertionResults: [] })),
    },
  ])
    assert.throws(() => recoveryTestCounts(value));
});
