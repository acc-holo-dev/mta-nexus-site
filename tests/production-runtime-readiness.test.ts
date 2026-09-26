import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("production runtime readiness", () => {
  it("gates the production app on database and writable private storage", () => {
    const compose = read("compose.production.yaml");
    const dockerfile = read("Dockerfile");
    const readiness = read("scripts/check-local-readiness.mjs");

    expect(compose).toContain(
      'test: ["CMD", "node", "scripts/check-local-readiness.mjs"]',
    );
    expect(compose).toContain("condition: service_healthy");
    expect(dockerfile).toContain(
      "COPY --from=build /app/scripts/check-local-readiness.mjs /app/scripts/check-local-readiness.mjs",
    );
    expect(readiness).toContain("health.database");
    expect(readiness).toContain("mkdtemp");
    expect(readiness).toContain("writeFile");
    expect(readiness).toContain("readFile");
    expect(compose).toContain("timeout: 15s");
  });

  it("keeps storage readiness private instead of widening the public health endpoint", () => {
    const health = read("apps/web/src/app/api/health/route.ts");

    expect(health).toContain("checkDatabaseConnection()");
    expect(health).not.toContain("STORAGE_LOCAL_PATH");
    expect(health).not.toContain("writeFile");
    expect(health).toContain('"Cache-Control": "no-store"');
  });
});
