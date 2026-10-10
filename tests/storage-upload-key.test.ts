import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { LocalStorageProvider } from "../packages/storage/src/local-provider";

const state = vi.hoisted(() => ({ provider: null as LocalStorageProvider | null, next: 0 }));
vi.mock("../packages/storage/src/provider-factory", () => ({
  getStorageProvider: () => {
    if (!state.provider) throw new Error("Test storage not initialized");
    return state.provider;
  },
}));
vi.mock("@nexus/security", () => ({ generateId: () => `ast_test_${++state.next}` }));
import { StorageService } from "../packages/storage/src/storage-service";

let root: string;
const service = new StorageService();
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "nexus-upload-key-"));
  state.provider = new LocalStorageProvider(root);
  state.next = 0;
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

it.each([
  `${"long-name".repeat(100)}.zip`,
  `${"ресурс🚗".repeat(100)}.ZIP`,
  "../../private/name.zip",
  "C:\\Users\\private\\archive.zip",
])("stores independently of the original filename: %s", async (fileName) => {
  const asset = await service.uploadAsset({
    data: Buffer.from("archive"),
    fileName,
    mimeType: "application/zip",
    userId: "usr_owner",
    isPrivate: true,
  });
  expect(asset.key).toBe("assets/usr_owner/ast_test_1.zip");
  expect(asset.isPrivate).toBe(true);
  expect(await readdir(join(root, "assets/usr_owner"))).toEqual(["ast_test_1.zip"]);
  const stored = await service.getDownloadStream(asset.key);
  expect(stored.meta?.sha256Hash).toBe(asset.sha256Hash);
  const chunks: Buffer[] = [];
  for await (const chunk of stored.stream as Readable) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe("archive");
});

it.each(["../other", "a/b", "a\\b", "", ".", "owner\0", "x".repeat(129)])(
  "rejects invalid owner %j without writing files",
  async (userId) => {
    await expect(
      service.uploadAsset({
        data: Buffer.from("archive"),
        fileName: "archive.zip",
        mimeType: "application/zip",
        userId,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(await readdir(root)).toEqual([]);
  },
);

it("keeps repeated original filenames as distinct immutable uploads", async () => {
  const input = {
    data: Buffer.from("archive"),
    fileName: "archive.zip",
    mimeType: "application/zip",
    userId: "usr_owner",
  };
  const first = await service.uploadAsset(input);
  const second = await service.uploadAsset(input);
  expect(first.key).not.toBe(second.key);
  expect(await readdir(join(root, "assets/usr_owner"))).toHaveLength(2);
});

it("retains extension validation before creating a generated key", async () => {
  await expect(
    service.uploadAsset({
      data: Buffer.from("archive"),
      fileName: "archive.exe",
      mimeType: "application/zip",
      userId: "usr_owner",
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  expect(await readdir(root)).toEqual([]);
});

it("opens a download once, without an existence preflight race", async () => {
  const asset = await service.uploadAsset({
    data: Buffer.from("verified archive"),
    fileName: "archive.zip",
    mimeType: "application/zip",
    userId: "usr_owner",
  });
  const provider = state.provider!;
  const preflight = vi.spyOn(provider, "exists").mockRejectedValue(new Error("exists must not be called"));
  const opened = await service.getDownloadStream(asset.key);
  expect(preflight).not.toHaveBeenCalled();
  expect(opened.meta.sha256Hash).toBe(asset.sha256Hash);
  const chunks: Buffer[] = [];
  for await (const chunk of opened.stream as Readable) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe("verified archive");
});

it("maps missing bytes directly from open to a missing asset error", async () => {
  await expect(service.getDownloadStream("assets/usr_owner/missing.zip"))
    .rejects.toMatchObject({ code: "VALIDATION_FAILED" });
});

it.each([".luac", ".dff", ".txd", ".col", ".png", ".jpg", ".jpeg", ".webp", ".json", ".map"])(
  "uploads supported %s artifacts with their original extension",
  async (ext) => {
    const bytes = Buffer.from("asset bytes");
    const asset = await service.uploadAsset({
      data: bytes,
      fileName: "payload" + ext,
      mimeType: "application/octet-stream",
      userId: "usr_owner",
    });
    expect(asset.key.endsWith(ext)).toBe(true);
    const download = await service.getDownloadStream(asset.key);
    const received: Buffer[] = [];
    for await (const chunk of download.stream as Readable) received.push(Buffer.from(chunk));
    expect(Buffer.concat(received)).toEqual(bytes);
  },
);

// Provider-level checks are not enough: cancellation may occur between
// adapter completion and the caller resuming after its await.
it("destroys an opened provider stream when cancellation wins the return race", async () => {
  const controller = new AbortController();
  const provider = state.provider!;
  const stream = Readable.from([Buffer.from("pending content")]);
  const key = "assets/usr_owner/stale.zip";
  const get = vi.spyOn(provider, "get").mockImplementation(async () => {
    controller.abort();
    return {
      stream,
      meta: { key, sizeBytes: 15, sha256Hash: "a".repeat(64) },
    };
  });
  await expect(service.getDownloadStream(key, controller.signal))
    .rejects.toMatchObject({ name: "AbortError" });
  expect(get).toHaveBeenCalledOnce();
  expect(stream.destroyed).toBe(true);
});

it.each(["key", "sizeBytes", "sha256Hash"] as const)(
  "rejects incorrect %s returned by an upload provider and cleans up the new object",
  async (field) => {
    const provider = state.provider!;
    const originalPut = provider.put.bind(provider);
    vi.spyOn(provider, "put").mockImplementation(async (...args) => {
      const meta = await originalPut(...args);
      switch (field) {
        case "key":
          return { ...meta, key: "assets/someone_else/different.zip" };
        case "sizeBytes":
          return { ...meta, sizeBytes: meta.sizeBytes + 1 };
        case "sha256Hash":
          return { ...meta, sha256Hash: "0".repeat(64) };
      }
    });

    await expect(service.uploadAsset({
      data: Buffer.from("asset integrity check"),
      fileName: "asset.zip",
      mimeType: "application/zip",
      userId: "usr_owner",
    })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(await readdir(join(root, "assets/usr_owner"))).toEqual([]);
  },
);

it.each(["key", "sizeBytes", "sha256Hash"] as const)(
  "closes a raw download if the provider supplies invalid %s metadata",
  async (field) => {
    const asset = await service.uploadAsset({
      data: Buffer.from("verified archive"),
      fileName: "asset.zip",
      mimeType: "application/zip",
      userId: "usr_owner",
    });
    const provider = state.provider!;
    const originalGet = provider.get.bind(provider);
    let openedStream: Readable | undefined;
    vi.spyOn(provider, "get").mockImplementation(async (...args) => {
      const result = await originalGet(...args);
      openedStream = result.stream as Readable;
      if (field === "key") {
        return { ...result, meta: { ...result.meta, key: "assets/other/file.zip" } };
      }
      if (field === "sizeBytes") {
        return { ...result, meta: { ...result.meta, sizeBytes: -1 } };
      }
      return { ...result, meta: { ...result.meta, sha256Hash: "not-a-digest" } };
    });

    await expect(service.getDownloadStream(asset.key))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(openedStream).toBeDefined();
    expect(openedStream?.destroyed).toBe(true);
  },
);
