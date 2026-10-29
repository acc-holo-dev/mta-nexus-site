import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("deterministic development startup contract", () => {
  it("makes pnpm dev start the full preflighted Docker development stack", () => {
    const pkg = JSON.parse(read("package.json"));

    expect(pkg.scripts.dev).toBe("pnpm dev:docker");
    expect(pkg.scripts["dev:host"]).toBe("pnpm --filter @nexus/web dev");
    expect(pkg.scripts["dev:preflight"]).toBe("pnpm nexus:doctor");
    expect(pkg.scripts["dev:docker"]).toContain("pnpm dev:preflight && docker compose");
    expect(pkg.scripts["dev:docker:up"]).toContain("pnpm dev:preflight && docker compose");
  });

  it("keeps the local stack private except for the loopback application port", () => {
    const compose = read("compose.yaml");

    const dollar = "$";
    expect(compose).toContain(`"127.0.0.1:${dollar}{NEXUS_DEV_PORT:-3000}:3000"`);
    expect(compose).not.toMatch(/5432:5432/u);
    expect(compose).not.toMatch(/3310:3310/u);
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain('test: ["CMD", "node", "scripts/check-local-readiness.mjs"]');
  });

  it("keeps app and delivery workers under init with SIGTERM grace and health probes", () => {
    const compose = read("compose.yaml");
    const pkg = JSON.parse(read("package.json"));
    const pushWorker = compose.slice(compose.indexOf("\n  push-worker:"));

    expect(compose).toContain("\n    init: true\n");
    expect(pushWorker).toContain("init: true");
    expect(pushWorker).toContain("stop_grace_period: 30s");
    expect(pushWorker).toContain("/app/scripts/check-web-push-worker-health.mjs");
    expect(compose).toContain("/app/scripts/check-license-worker-health.mjs");
    expect(compose).toContain("/app/scripts/check-resource-release-worker-health.mjs");
    expect(compose).toContain("./packages/validation/src:/app/packages/validation/src:ro");
    expect(pkg.scripts["dev:docker:check"]).toContain("scripts/check-local-readiness.mjs");
    expect(pkg.scripts["dev:docker:check"]).toContain("check-web-push-worker-health.mjs");
    expect(pkg.scripts["dev:docker:down"]).toContain("docker compose");
  });

  it("documents full-stack and host-only startup as different modes", () => {
    const readme = read("README.md");
    const operations = read("docs/OPERATIONS.md");

    for (const document of [readme, operations]) {
      expect(document).toContain("pnpm dev");
      expect(document).toContain("pnpm dev:host");
    }
    expect(readme).toContain("full Docker development stack");
    expect(operations).toContain("starts only the Next.js development server");
    expect(operations).toContain("distinguish process heartbeat from dispatcher progress");
    expect(operations).toContain("pnpm dev:docker:check");
    expect(operations).toContain("pnpm dev:docker:down");
  });
});

describe("host toolchain version contract", () => {
  it("pins the same Node release for common version managers", () => {
    const nvm = read(".nvmrc").trim();
    const nodeVersion = read(".node-version").trim();
    const pkg = JSON.parse(read("package.json"));

    expect(nvm).toBe("26.10.0");
    expect(nodeVersion).toBe(nvm);
    expect(pkg.engines.node).toBe(">=26.0.0");
    expect(pkg.packageManager).toBe("pnpm@12.4.2");
  });
});

describe("beta version consistency", () => {
  it("pins the complete workspace to 1.2.0-beta.3", () => {
    const manifests = [
      "package.json",
      "apps/web/package.json",
      "packages/config/package.json",
      "packages/db/package.json",
      "packages/domain/package.json",
      "packages/security/package.json",
      "packages/storage/package.json",
      "packages/ui/package.json",
      "packages/validation/package.json",
    ];

    for (const path of manifests) {
      expect(JSON.parse(read(path)).version).toBe("1.2.0-beta.3");
    }

    expect(read("README.md")).toContain("1.2.0-beta.3");
    expect(read("docs/OPERATIONS.md")).toContain("1.2.0-beta.3");
  });
});
