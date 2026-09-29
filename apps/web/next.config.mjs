import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Compose app hostname is used by browser tests inside the dev network.
  allowedDevOrigins: ["nexus-local-app-1"],
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
