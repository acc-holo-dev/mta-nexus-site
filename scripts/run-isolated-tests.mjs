#!/usr/bin/env node
// Runs the Vitest suite against a freshly recreated disposable PostgreSQL
// database inside the local development stack.
//
// Some suites (D2a/D2b account-mail queue capacity, transaction serialization)
// assume an empty database. Against the long-lived `mta_nexus` development
// database those preconditions do not hold, so this script drops and recreates
// `mta_nexus_test`, applies migrations and runs the full suite with
// DATABASE_URL pointed at the disposable database.
//
// Requires the local development stack: pnpm dev:docker:up
import { execSync } from "node:child_process";
import process from "node:process";

const composeArgs = [
  "docker",
  "compose",
  "-p",
  "nexus-local",
  "-f",
  "compose.yaml",
];
const composeCommand = composeArgs.join(" ");
const testDatabase = "mta_nexus_test";
const testDatabaseUrl = `postgres://nexus:nexus_secret@postgres:5432/${testDatabase}`;

function run(command) {
  execSync(command, { stdio: "inherit" });
}

try {
  run(
    `${composeCommand} exec -T postgres psql -X -U nexus -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${testDatabase} WITH (FORCE)"`,
  );
  run(
    `${composeCommand} exec -T postgres psql -X -U nexus -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${testDatabase}"`,
  );
  run(
    `${composeCommand} exec -T -e DATABASE_URL=${testDatabaseUrl} app sh -c "pnpm db:migrate && DATABASE_URL=${testDatabaseUrl} pnpm test"`,
  );
} catch (error) {
  process.exitCode = error.status ?? 1;
}
