import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalStorageProvider } from "../packages/storage/src/local-provider";

let root: string;
let storage: LocalStorageProvider;
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), "nexus-atomic-"));
  storage = new LocalStorageProvider(root);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

it("publishes a complete private file without exposing a partially written destination", async () => {
  const link = fs.link.bind(fs);
  const bytes = Buffer.alloc(256 * 1024, 7);
  vi.spyOn(fs, "link").mockImplementation(async (source, target) => {
    await expect(fs.stat(target)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readFile(source)).toEqual(bytes);
    await link(source, target);
  });
  const result = await storage.put("archive.zip", bytes, "application/zip");
  expect(result.sha256Hash).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect(await fs.readdir(root)).toEqual(["archive.zip"]);
  expect((await fs.stat(join(root, "archive.zip"))).mode & 0o777).toBe(0o600);
});

it("rejects overwriting a published key, including identical bytes", async () => {
  await storage.put("archive.zip", Buffer.from("original"), "application/zip");
  for (const value of ["replacement", "original"]) {
    await expect(
      storage.put("archive.zip", Buffer.from(value), "application/zip"),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
  }
  expect(await fs.readFile(join(root, "archive.zip"), "utf8")).toBe("original");
  expect(await fs.readdir(root)).toEqual(["archive.zip"]);
});

it("allows exactly one concurrent writer for the same key", async () => {
  const values = [Buffer.alloc(128 * 1024, 1), Buffer.alloc(128 * 1024, 2)];
  const results = await Promise.allSettled(
    values.map((bytes) => storage.put("archive.zip", bytes, "application/zip")),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const winner = results.findIndex((result) => result.status === "fulfilled");
  expect(await fs.readFile(join(root, "archive.zip"))).toEqual(values[winner]);
  expect(await fs.readdir(root)).toEqual(["archive.zip"]);
});

it("cleans temporary bytes when publication fails", async () => {
  vi.spyOn(fs, "link").mockRejectedValue(Object.assign(new Error("disk error"), { code: "EIO" }));
  await expect(storage.put("archive.zip", Buffer.from("data"), "application/zip")).rejects.toThrow(
    "disk error",
  );
  expect(await fs.readdir(root)).toEqual([]);
});

it("snapshots caller-owned memory before asynchronous writing", async () => {
  const bytes = Buffer.from("original");
  const upload = storage.put("archive.zip", bytes, "application/zip");
  bytes.fill(0);
  const result = await upload;
  expect(await fs.readFile(join(root, "archive.zip"), "utf8")).toBe("original");
  expect(result.sha256Hash).toBe(createHash("sha256").update("original").digest("hex"));
});

it("closes and removes the temporary file after a write failure", async () => {
  const open = fs.open.bind(fs);
  const close = vi.fn();
  vi.spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await open(...args);
    // Only the temporary upload handle writes archive data. Pinned parent
    // directories are separate descriptors and should not skew this test.
    if (!String(args[0]).endsWith(".tmp")) return handle;
    const originalClose = handle.close.bind(handle);
    vi.spyOn(handle, "writeFile").mockRejectedValue(new Error("disk full"));
    vi.spyOn(handle, "close").mockImplementation(async () => {
      close();
      await originalClose();
    });
    return handle;
  });
  await expect(storage.put("archive.zip", Buffer.from("data"), "application/zip")).rejects.toThrow(
    "disk full",
  );
  expect(close).toHaveBeenCalledOnce();
  expect(await fs.readdir(root)).toEqual([]);
});
