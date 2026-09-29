import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  config: { NODE_ENV: "test", STORAGE_PROVIDER: "local", STORAGE_LOCAL_PATH: "" },
  persist: vi.fn(async (_data: unknown, _options: unknown) => ({
    inserted: 13,
    repairedBuilds: 0,
  })),
}));
vi.mock("@nexus/config", () => ({ config: fixture.config }));
vi.mock("@nexus/security", () => ({ hashPassword: async () => "test-only-hash" }));
vi.mock("../packages/db/src/seed-baseline", () => ({ seedBaseline: fixture.persist }));
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
  const data = fixture.persist.mock.calls[0][0] as {
    builds: {
      storageKey: string;
      fileSizeBytes: number;
      sha256Hash: string;
      releaseNotes: string;
    }[];
  };
  expect(data.builds).toHaveLength(2);
  for (const build of data.builds) {
    const bytes = await readFile(join(root, build.storageKey));
    expect(build.fileSizeBytes).toBe(bytes.length);
    expect(build.sha256Hash).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(build.releaseNotes).toContain("demo archive");
  }
  expect(fixture.persist).toHaveBeenCalledOnce();
});

it("rejects production before any repository mutation", async () => {
  fixture.config.NODE_ENV = "production";
  await expect(runSeed()).rejects.toThrow("disabled in production");
  expect(fixture.persist).not.toHaveBeenCalled();
});
