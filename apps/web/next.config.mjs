import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Stable Compose service DNS is used by dev-network/browser verification. Keep
  // the historical default container name for existing local stacks as well.
  allowedDevOrigins: ["app", "nexus-local-app-1"],
  output: "standalone",
  outputFileTracingRoot: repositoryRoot,
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
