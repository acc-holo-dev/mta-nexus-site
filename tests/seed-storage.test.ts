import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  config: { NODE_ENV: "test", STORAGE_PROVIDER: "local", STORAGE_LOCAL_PATH: "" },
  create: vi.fn(async (value: Record<string, unknown>) => value),
  record: vi.fn(),
}));
vi.mock("@nexus/config", () => ({ config: fixture.config }));
vi.mock("@nexus/security", () => ({ hashPassword: async () => "test-only-hash" }));
vi.mock("../packages/db/src/repositories/index", () => ({
  ...Object.fromEntries(
    [
      "userRepository",
      "organizationRepository",
      "serverRepository",
      "productRepository",
      "buildRepository",
      "licenseRepository",
      "contentRepository",
    ].map((name) => [name, { create: fixture.create }]),
  ),
  auditRepository: { record: fixture.record },
}));
import { runSeed } from "../packages/db/src/seed";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "nexus-seed-storage-"));
  fixture.config.STORAGE_LOCAL_PATH = root;
  fixture.config.NODE_ENV = "test";
  vi.clearAllMocks();
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

it("creates a build whose metadata matches the actual downloadable archive", async () => {
  await runSeed();
  const build = fixture.create.mock.calls
    .map(([value]) => value)
    .find((value) => value.id === "bld_inv_320");
  if (!build) throw new Error("Seed did not create its inventory build");
  const bytes = await readFile(join(root, String(build.storageKey)));
  expect(build.fileSizeBytes).toBe(bytes.length);
  expect(build.sha256Hash).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(build.releaseNotes).toContain("demo archive");
  expect(fixture.record).toHaveBeenCalledOnce();
});

it("rejects production before any repository mutation", async () => {
  fixture.config.NODE_ENV = "production";
  await expect(runSeed()).rejects.toThrow("disabled in production");
  expect(fixture.create).not.toHaveBeenCalled();
  expect(fixture.record).not.toHaveBeenCalled();
});
