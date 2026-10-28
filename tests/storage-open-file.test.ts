import fs from "node:fs/promises";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@nexus/domain";
import type { Readable } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalStorageProvider } from "../packages/storage/src/local-provider";

let root: string;
let storage: LocalStorageProvider;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "nexus-open-"));
  storage = new LocalStorageProvider(root);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

it("streams the same open file that supplied metadata even after pathname replacement", async () => {
  await storage.put("build.zip", Buffer.from("original"), "application/zip");
  const opened = await storage.get("build.zip");
  await writeFile(join(root, "replacement"), "new");
  await rename(join(root, "replacement"), join(root, "build.zip"));
  const chunks: Buffer[] = [];
  for await (const chunk of opened.stream as Readable) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe("original");
  expect(opened.meta?.sizeBytes).toBe(8);
  expect(opened.meta?.sha256Hash).toBe(createHash("sha256").update("original").digest("hex"));
});

it("rejects a missing file before returning a stream", async () => {
  await expect(storage.get("missing.zip")).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects directories as download objects and refuses a root-directory key", async () => {
  await fs.mkdir(join(root, "directory"));
  await expect(storage.get("directory")).rejects.toThrow("regular file");
  await expect(storage.get(".")).rejects.toThrow("Invalid storage key");
});

it("rejects an oversized direct provider upload before touching the filesystem", async () => {
  await expect(
    storage.put(
      "oversized-direct.zip",
      Buffer.alloc(MAX_UPLOAD_FILE_SIZE_BYTES + 1),
      "application/zip",
    ),
  ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  await expect(fs.stat(join(root, "oversized-direct.zip"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});

it("rejects an oversized on-disk object before expensive hashing or streaming", async () => {
  await storage.put("oversized.zip", Buffer.from("original"), "application/zip");
  await fs.truncate(join(root, "oversized.zip"), MAX_UPLOAD_FILE_SIZE_BYTES + 1);
  await expect(storage.get("oversized.zip")).rejects.toThrow(
    "Storage object exceeds maximum supported size",
  );
});

it("hashes multi-chunk files without consuming the returned download stream", async () => {
  const bytes = Buffer.alloc(192 * 1024 + 17, 37);
  const uploaded = await storage.put("large.zip", bytes, "application/zip");
  const opened = await storage.get("large.zip");
  expect(opened.meta?.sha256Hash).toBe(uploaded.sha256Hash);
  const chunks: Buffer[] = [];
  for await (const chunk of opened.stream as Readable) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks)).toEqual(bytes);
});

it("reports the real hash after same-size external corruption", async () => {
  const uploaded = await storage.put("build.zip", Buffer.from("original"), "application/zip");
  await writeFile(join(root, "build.zip"), "corrupt!");
  const opened = await storage.get("build.zip");
  expect(opened.meta?.sizeBytes).toBe(uploaded.sizeBytes);
  expect(opened.meta?.sha256Hash).not.toBe(uploaded.sha256Hash);
  (opened.stream as Readable).destroy();
});

it("does not open a file for an already cancelled download", async () => {
  const open = vi.spyOn(fs, "open");
  const controller = new AbortController();
  controller.abort();
  await expect(storage.get("missing.zip", controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(open).not.toHaveBeenCalled();
});

it("stops hashing between chunks and closes the file on cancellation", async () => {
  await storage.put("large.zip", Buffer.alloc(192 * 1024, 3), "application/zip");
  const controller = new AbortController();
  const open = fs.open.bind(fs);
  const closed = vi.fn();
  const read = vi.fn();
  vi.spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await open(...args);
    // The storage provider also opens pinned directory descriptors. Spy on
    // the actual asset file handle, not those independently closed parents.
    if (!String(args[0]).endsWith("/large.zip")) return handle;
    const originalRead = handle.read.bind(handle);
    const originalClose = handle.close.bind(handle);
    vi.spyOn(handle, "read").mockImplementation(
      async (...readArgs: Parameters<typeof handle.read>) => {
        const result = await originalRead(...readArgs);
        read();
        controller.abort();
        return result;
      },
    );
    vi.spyOn(handle, "close").mockImplementation(async () => {
      closed();
      await originalClose();
    });
    return handle;
  });
  await expect(storage.get("large.zip", controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(read).toHaveBeenCalledOnce();
  expect(closed).toHaveBeenCalledOnce();
});

it("closes a prepared stream when its request is cancelled", async () => {
  await storage.put("build.zip", Buffer.from("original"), "application/zip");
  const controller = new AbortController();
  const opened = await storage.get("build.zip", controller.signal);
  const closed = once(opened.stream, "close");
  controller.abort();
  await closed;
  expect((opened.stream as Readable).destroyed).toBe(true);
});

it("rejects and destroys a download cancelled inside createReadStream", async () => {
  await storage.put("build.zip", Buffer.from("cancelled bytes"), "application/zip");
  const controller = new AbortController();
  const open = fs.open.bind(fs);
  let openedStream: Readable | undefined;
  vi.spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await open(...args);
    if (!String(args[0]).endsWith("/build.zip")) return handle;
    const createStream = handle.createReadStream.bind(handle);
    vi.spyOn(handle, "createReadStream").mockImplementation((options) => {
      const stream = createStream(options);
      openedStream = stream;
      // Exercise the exact gap between stream creation and registering
      // the provider's AbortSignal handler.
      controller.abort();
      return stream;
    });
    return handle;
  });

  await expect(storage.get("build.zip", controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(openedStream).toBeDefined();
  expect(openedStream?.destroyed).toBe(true);
});

it("removes the request abort listener after a completed download", async () => {
  await storage.put("build.zip", Buffer.from("original"), "application/zip");
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  const opened = await storage.get("build.zip", controller.signal);
  for await (const _chunk of opened.stream as Readable) {
    /* drain */
  }
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});
