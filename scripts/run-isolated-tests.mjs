#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Each invocation owns a new database. Never recreate a shared development or
// test database: another developer or test run may still be using it.
const compose = ["compose", "-p", "nexus-local", "-f", "compose.yaml"];
const database = `nexus_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = `postgres://nexus:nexus_secret@postgres:5432/${database}`;
const app = [
  "exec",
  "-T",
  "-e",
  `DATABASE_URL=${databaseUrl}`,
  "-e",
  "NEXUS_DISPOSABLE_DATABASE=1",
  "app",
];
const run = (args) => execFileSync("docker", [...compose, ...args], { stdio: "inherit" });
let created = false;
try {
  run(["exec", "-T", "postgres", "createdb", "-U", "nexus", database]);
  created = true;
  run([...app, "pnpm", "db:migrate"]);
  // Match CI: unit without the Compose APP_URL; database keeps it.
  run([...app, "env", "-u", "NEXT_PUBLIC_APP_URL", "pnpm", "test:unit"]);
  run([...app, "pnpm", "test:database"]);
} catch (error) {
  process.exitCode = error.status ?? 1;
} finally {
  if (created) {
    try {
      run(["exec", "-T", "postgres", "dropdb", "-U", "nexus", database]);
    } catch (error) {
      console.error(`Failed to remove owned test database ${database}`);
      process.exitCode ||= error.status ?? 1;
    }
  }
}
