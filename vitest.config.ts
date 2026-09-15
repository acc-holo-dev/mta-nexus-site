import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
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
