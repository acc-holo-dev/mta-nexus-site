import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";
import { classifyTests } from "./scripts/test-projects.mjs";

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
const testFiles = classifyTests(__dirname, focusedFiles as string[] | undefined);

export default defineConfig({
  // Match Next.js: JSX uses the automatic React runtime, including shared packages.
  esbuild: { jsx: "automatic" },
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
          // Sequential files can reuse the transformed module graph and one
          // postgres.js pool. Isolation stays on for unit tests that mock heavily.
          isolate: false,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@nexus/config": path.resolve(__dirname, "./packages/config/src"),
      "@nexus/domain": path.resolve(__dirname, "./packages/domain/src"),
      "@nexus/validation": path.resolve(__dirname, "./packages/validation/src"),
      "@nexus/security": path.resolve(__dirname, "./packages/security/src"),
      "@nexus/storage": path.resolve(__dirname, "./packages/storage/src"),
      "@nexus/db": path.resolve(__dirname, "./packages/db/src"),
      "@nexus/ui": path.resolve(__dirname, "./packages/ui/src"),
    },
  },
});
