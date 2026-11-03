import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  config: {
    NODE_ENV: "development",
    DATABASE_URL: "postgres://nexus:test@127.0.0.1:5432/mta_nexus",
  },
  hashPassword: vi.fn(async () => "test-only-hash"),
  persist: vi.fn(async () => ({ inserted: 1 })),
}));

vi.mock("@nexus/config", () => ({ config: fixture.config }));
vi.mock("@nexus/security", () => ({ hashPassword: fixture.hashPassword }));
vi.mock("../packages/db/src/historical-seed", () => ({ seedHistorical: fixture.persist }));

import { runHistoricalSeed } from "../packages/db/src/seed-historical";

beforeEach(() => {
  fixture.config.NODE_ENV = "development";
  vi.clearAllMocks();
});

it("rejects an unacknowledged run before hashing or database mutation", async () => {
  await expect(runHistoricalSeed({})).rejects.toThrow("NEXUS_DEMO_SEED_ACK=development-only");
  expect(fixture.hashPassword).not.toHaveBeenCalled();
  expect(fixture.persist).not.toHaveBeenCalled();
});

it("rejects production before hashing or database mutation", async () => {
  fixture.config.NODE_ENV = "production";
  await expect(runHistoricalSeed({ NEXUS_DEMO_SEED_ACK: "development-only" })).rejects.toThrow(
    "disabled in production",
  );
  expect(fixture.hashPassword).not.toHaveBeenCalled();
  expect(fixture.persist).not.toHaveBeenCalled();
});

it("runs after explicit acknowledgement in development", async () => {
  await expect(runHistoricalSeed({ NEXUS_DEMO_SEED_ACK: "development-only" })).resolves.toEqual({
    inserted: 1,
  });
  expect(fixture.hashPassword).toHaveBeenCalledWith("password123");
  expect(fixture.persist).toHaveBeenCalledWith({ passwordHash: "test-only-hash" });
});
