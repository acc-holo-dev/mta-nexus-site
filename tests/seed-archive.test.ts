import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureSeedArchive } from "../packages/db/src/seed-archive";

let root: string;
const options = () => ({ NODE_ENV: "test", STORAGE_PROVIDER: "local", STORAGE_LOCAL_PATH: root });
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "nexus-seed-test-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("development seed archive", () => {
  it("writes bytes matching database metadata and preserves them on repeated runs", async () => {
    const first = await ensureSeedArchive(options());
    const path = join(root, first.storageKey);
    const bytes = await readFile(path);
    const before = await stat(path);
    expect(first.fileSizeBytes).toBe(bytes.length);
    expect(first.sha256Hash).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    expect(bytes.toString()).toContain("does not contain the advertised inventory system");
    expect(await ensureSeedArchive(options())).toEqual(first);
    expect((await stat(path)).mtimeMs).toBe(before.mtimeMs);
    expect(await readdir(join(root, "builds/prd_inv_pro"))).toEqual(["v3.2.0.zip"]);
  });

  it("handles concurrent creation without leaving temporary files", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => ensureSeedArchive(options())),
    );
    expect(new Set(results.map((value) => value.sha256Hash)).size).toBe(1);
    expect(await readdir(join(root, "builds/prd_inv_pro"))).toEqual(["v3.2.0.zip"]);
  });

  it("refuses to overwrite a different existing file", async () => {
    const entry = await ensureSeedArchive(options());
    const path = join(root, entry.storageKey);
    await writeFile(path, "existing user file");
    await expect(ensureSeedArchive(options())).rejects.toThrow("conflicts");
    expect(await readFile(path, "utf8")).toBe("existing user file");
    expect(await readdir(join(root, "builds/prd_inv_pro"))).toEqual(["v3.2.0.zip"]);
  });

  it.each([
    { NODE_ENV: "production" },
    { STORAGE_PROVIDER: "s3" },
    { STORAGE_LOCAL_PATH: "./uploads" },
  ])("rejects unsafe or ambiguous configuration before writing (%#)", async (override) => {
    await expect(ensureSeedArchive({ ...options(), ...override })).rejects.toThrow();
    expect(await readdir(root)).toEqual([]);
  });
});
