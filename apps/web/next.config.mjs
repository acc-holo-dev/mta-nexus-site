import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep compilation and route collection within constrained build environments.
  experimental: { cpus: 2, webpackMemoryOptimizations: true },
  // Stable Compose service DNS is used by dev-network/browser verification. Keep
  // the historical default container name for existing local stacks as well.
  allowedDevOrigins: ["app", "nexus-local-app-1"],
  output: "standalone",
  outputFileTracingRoot: repositoryRoot,
  // Local storage and absolute mail-secret file paths are runtime mounts, so
  // Turbopack cannot prove a static tree and may warn about whole-project
  // tracing. These excludes keep non-runtime checkout trees out of the
  // standalone NFT output; migrations/workers still deploy via /runtime/db.
  // Remaining warnings are bounded by that exclude set plus the non-root
  // runtime image (USER node, writable only under /data/uploads).
  outputFileTracingExcludes: {
    "/*": [
      "../../apps/web/src/**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}",
      "../../packages/**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}",
      "../../packages/db/migrations/**/*",
      "../../packages/db/scripts/**/*",
      "../../tests/**/*",
      "../../scripts/**/*",
      "../../docs/**/*",
      "../../deploy/**/*",
      "../../.github/**/*",
      "../../artifacts/**/*",
      "../../uploads/**/*",
      "../../.git/**/*",
      "../../.env*",
      "../../compose*.yaml",
      "../../vitest.config.*",
      "../../playwright*.mjs",
      "./.env*",
    ],
  },
  transpilePackages: [
    "@nexus/config",
    "@nexus/domain",
    "@nexus/validation",
    "@nexus/security",
    "@nexus/storage",
    "@nexus/db",
    "@nexus/ui",
  ],
};

export default nextConfig;
