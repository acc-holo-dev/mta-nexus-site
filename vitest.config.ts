import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import { classifyTests } from "./scripts/test-projects.mjs";

const rootDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

// The focused runner passes explicit files so a small change does not require
// classifying every test and its import graph. Normal runs still discover all tests.
const focused = process.env.NEXUS_FOCUSED_TEST_FILES;
const focusedFiles: unknown = focused ? JSON.parse(focused) : undefined;
const explicitFiles = process.argv.filter((arg) => /\.(test|spec)\.[cm]?[jt]sx?$/u.test(arg));
if (
  focusedFiles !== undefined &&
  (!Array.isArray(focusedFiles) ||
    focusedFiles.length === 0 ||
    !focusedFiles.every((file) => typeof file === "string" && explicitFiles.includes(file)) ||
    explicitFiles.some((file) => !focusedFiles.includes(file)))
) {
  throw new Error("Focused test selection must match the explicit Vitest file arguments");
}
const testFiles = classifyTests(rootDir, focusedFiles as string[] | undefined);

export default defineConfig({
  // Vite 8 transforms via Oxc; keep the automatic React JSX runtime used by Next.js.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globals: true,
    // Standalone builds copy source tests; never execute those generated copies.
    exclude: [...configDefaults.exclude, "**/.next/**"],
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: testFiles.unit,
          fileParallelism: true,
          // Avoid dozens of workers competing for memory on developer hosts.
          maxWorkers: 4,
          isolate: true,
        },
      },
      {
        extends: true,
        test: {
          name: "database",
          include: testFiles.database,
          // Queue capacity, leases and exact counts share one disposable DB.
          fileParallelism: false,
          // Temp-table suites mock `packages/db/src/client` with a per-file Proxy.
          // Sharing the module graph across files leaves repositories bound to
          // another file's Proxy/`active.db`, so inserts hit public tables and
          // reads return empty. Isolate each file so its client mock applies.
          isolate: true,
          maxWorkers: 1,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@nexus/config": path.resolve(rootDir, "./packages/config/src"),
      "@nexus/domain": path.resolve(rootDir, "./packages/domain/src"),
      "@nexus/validation": path.resolve(rootDir, "./packages/validation/src"),
      "@nexus/security": path.resolve(rootDir, "./packages/security/src"),
      "@nexus/storage": path.resolve(rootDir, "./packages/storage/src"),
      "@nexus/db": path.resolve(rootDir, "./packages/db/src"),
      "@nexus/ui": path.resolve(rootDir, "./packages/ui/src"),
    },
  },
});
