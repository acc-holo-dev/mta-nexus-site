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
  // Dynamic storage/secret paths make tracing conservative. These repository
  // files are never runtime inputs; migrations/workers are deployed separately.
  outputFileTracingExcludes: {
    "/*": [
      "../../apps/web/src/**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}",
      "../../packages/**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}",
      "../../tests/**/*",
      "../../scripts/tests/**/*",
      "../../docs/**/*",
      "../../artifacts/**/*",
      "../../.git/**/*",
      "../../.env*",
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
