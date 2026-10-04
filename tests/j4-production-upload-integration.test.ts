import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("J4 production upload integration candidate", () => {
  it("combines standalone runtime pruning with the exact proxy upload ceiling", () => {
    const dockerfile = read("Dockerfile");
    const caddy = read("deploy/Caddyfile");
    const startup = read("scripts/check-production-startup.sh");

    expect(dockerfile).toContain(
      "apps/web/.next/standalone/apps/web/server.js",
    );
    expect(dockerfile).toContain(
      "pnpm --filter @nexus/db --prod deploy /runtime/db",
    );
    expect(caddy).toContain("max_size 68157440");

    expect(startup).toContain("test -f /app/apps/web/server.js");
    expect(startup).toContain(
      "test -f /app/packages/db/node_modules/tsx/package.json",
    );
    expect(startup).toContain(
      "production runtime unexpectedly contains pnpm",
    );
    expect(startup).toContain("oversized-request.bin");
    expect(startup).toContain("oversized_code");
    expect(startup).toContain("[[ $oversized_code == 413 ]]");
  });

  it("keeps the database deploy payload executable without a runtime package manager", () => {
    const dbPackage = JSON.parse(read("packages/db/package.json"));
    const entrypoint = read("scripts/start-production.sh");

    expect(dbPackage.dependencies.tsx).toMatch(/^\^4\.\d+\.\d+$/u);
    expect(entrypoint).toContain("node --import tsx src/migrate.ts");
    expect(entrypoint).toContain("exec node server.js");
    expect(entrypoint).not.toContain("pnpm");
  });
});
