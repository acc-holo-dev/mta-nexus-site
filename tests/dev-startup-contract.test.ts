import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("deterministic development startup contract", () => {
  it("makes pnpm dev start the full preflighted Docker development stack", () => {
    const pkg = JSON.parse(read("package.json"));

    expect(pkg.scripts.dev).toBe("pnpm dev:docker");
    expect(pkg.scripts["dev:host"]).toBe(
      "pnpm --filter @nexus/web dev",
    );
    expect(pkg.scripts["dev:preflight"]).toBe("pnpm nexus:doctor");
    expect(pkg.scripts["dev:docker"]).toContain(
      "pnpm dev:preflight && docker compose",
    );
    expect(pkg.scripts["dev:docker:up"]).toContain(
      "pnpm dev:preflight && docker compose",
    );
  });

  it("keeps the local stack private except for the loopback application port", () => {
    const compose = read("compose.yaml");

    expect(compose).toContain(
      '"127.0.0.1:${NEXUS_DEV_PORT:-3000}:3000"',
    );
    expect(compose).not.toMatch(/5432:5432/u);
    expect(compose).not.toMatch(/3310:3310/u);
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain(
      'test: ["CMD", "node", "scripts/check-local-readiness.mjs"]',
    );
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
