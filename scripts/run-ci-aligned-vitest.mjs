#!/usr/bin/env node
/**
 * Run Vitest the way CI does, not as a single env for both projects.
 *
 * CI unit job (`pnpm check:code` → `test:unit`): no NEXT_PUBLIC_APP_URL.
 * CI verify job (`pnpm test:database`): DATABASE_URL + NEXT_PUBLIC_APP_URL set.
 *
 * Unit suites that POST with Origin http://nexus.test correctly fail closed when
 * APP_URL is localhost — that is CSRF working. Do not weaken CSRF or rewrite
 * Origins to greenwash; split the env instead.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(label, args, env) {
  process.stdout.write(`\n==> ${label}: ${pnpmCommand} ${args.join(" ")}\n`);
  const result = spawnSync(pnpmCommand, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

const sharedEnv = { ...process.env };
const unitEnv = { ...sharedEnv };
delete unitEnv.NEXT_PUBLIC_APP_URL;

const unitStatus = run("unit (CI shape: no NEXT_PUBLIC_APP_URL)", ["test:unit"], unitEnv);
if (unitStatus !== 0) {
  process.exit(unitStatus);
}

process.exit(run("database (CI shape: keep APP_URL)", ["test:database"], sharedEnv));
