import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDevelopmentSeedPassword } from "../packages/db/src/seed-guard";

describe("development database seed guard", () => {
  it("requires development mode and a caller-supplied seed password", () => {
    expect(() => getDevelopmentSeedPassword({ NODE_ENV: "production", DEV_SEED_PASSWORD: "long-enough-password" }))
      .toThrow("restricted to NODE_ENV=development");
    expect(() => getDevelopmentSeedPassword({ NODE_ENV: "test", DEV_SEED_PASSWORD: "long-enough-password" }))
      .toThrow("restricted to NODE_ENV=development");
    expect(() => getDevelopmentSeedPassword({ NODE_ENV: "development" }))
      .toThrow("Set DEV_SEED_PASSWORD");
    expect(() => getDevelopmentSeedPassword({ NODE_ENV: "development", DEV_SEED_PASSWORD: "short" }))
      .toThrow("Set DEV_SEED_PASSWORD");
  });

  it("uses exactly the supplied local password when the guard passes", () => {
    expect(getDevelopmentSeedPassword({
      NODE_ENV: "development",
      DEV_SEED_PASSWORD: "local-temporary-passphrase",
    })).toBe("local-temporary-passphrase");
  });

  it("keeps the executable seed and development guide free of a default credential", () => {
    const seed = readFileSync(resolve(process.cwd(), "packages/db/src/seed.ts"), "utf8");
    const guide = readFileSync(resolve(process.cwd(), "docs/DEVELOPMENT.md"), "utf8");
    expect(seed).toContain("const seedPassword = getDevelopmentSeedPassword()");
    expect(seed).toContain("hashPassword(seedPassword)");
    expect(seed).not.toContain("password123");
    expect(guide).not.toContain("password123");
  });
});
