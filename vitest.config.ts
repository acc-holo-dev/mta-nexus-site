import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";
import { classifyTests } from "./scripts/test-projects.mjs";

const testFiles = classifyTests(__dirname);

export default defineConfig({
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
          isolate: true,
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
