import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocalStorageProvider } from "../packages/storage/src/local-provider";

let root: string, provider: LocalStorageProvider;
const key = "assets/usr_test/ast_0123456789abcdef.zip",
  id = `smo_${"a".repeat(24)}`;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-maintenance-"));
  provider = new LocalStorageProvider(root);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});
async function fixture() {
  await provider.put(key, Buffer.from("private resource"), "application/zip");
  const age = new Date(Date.now() - 8 * 86400000);
  await fs.utimes(path.join(root, key), age, age);
  const page = await provider.discoverAssetNamespace("usr_test", 0);
  const identity = page.objects[0];
  if (!identity) throw new Error("Expected discovery fixture");
  return identity;
}
it("discovers the exact bytes, timestamps and private namespace without absolute paths", async () => {
  const identity = await fixture();
  expect(identity).toMatchObject({ key, sizeBytes: 16 });
  expect(identity.sha256Hash).toMatch(/^[a-f0-9]{64}$/u);
  expect(identity.inode).toMatch(/^\d+$/u);
  expect(await provider.listAssetNamespaces(0)).toEqual({
    owners: ["usr_test"],
    nextOffset: null,
    limited: false,
  });
  expect(JSON.stringify(identity)).not.toContain(root);
});
it("conditionally deletes only the observed regular file", async () => {
  const identity = await fixture();
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("deleted");
  await expect(fs.stat(path.join(root, key))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("missing");
});
it("preserves a replacement with identical bytes and modification time but another inode", async () => {
  const identity = await fixture(),
    file = path.join(root, key);
  await fs.rename(file, `${file}.old`);
  await fs.writeFile(file, "private resource");
  const age = new Date(identity.modifiedAt);
  await fs.utimes(file, age, age);
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("changed");
  expect(await fs.readFile(file, "utf8")).toBe("private resource");
});
it("preserves bytes changed on the same inode", async () => {
  const identity = await fixture();
  await fs.writeFile(path.join(root, key), "new private data");
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("changed");
  expect(await fs.readFile(path.join(root, key), "utf8")).toBe("new private data");
});
it("reports absence without claiming deletion", async () => {
  const identity = await fixture();
  await fs.unlink(path.join(root, key));
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("missing");
});
it("ignores symlinks, hardlinks, temporary and unknown files in discovery", async () => {
  await fixture();
  const dir = path.join(root, "assets/usr_test");
  await fs.symlink(path.join(root, key), path.join(dir, "ast_symlink.zip"));
  await fs.link(path.join(root, key), path.join(dir, "ast_hard.zip"));
  await fs.writeFile(path.join(dir, "ast_tmp.zip.tmp"), "tmp");
  await fs.writeFile(path.join(dir, "unknown.zip"), "unknown");
  const result = await provider.discoverAssetNamespace("usr_test", 0);
  expect(result.objects).toEqual([]);
  expect(result.skipped).toBe(5);
});
it("does not follow a symlink owner directory", async () => {
  await fs.mkdir(path.join(root, "assets"));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "outside-"));
  try {
    await fs.symlink(outside, path.join(root, "assets/usr_test"));
    await expect(provider.discoverAssetNamespace("usr_test", 0)).rejects.toThrow();
  } finally {
    await fs.rm(outside, { recursive: true, force: true });
  }
});
it("resumes the same staged object after an interrupted rename", async () => {
  const identity = await fixture(),
    file = path.join(root, key);
  await fs.rename(file, `${file}.${id}.cleanup`);
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("deleted");
  await expect(fs.stat(`${file}.${id}.cleanup`)).rejects.toMatchObject({ code: "ENOENT" });
});
it("preserves both staged bytes and a concurrent replacement", async () => {
  const identity = await fixture(),
    file = path.join(root, key);
  await fs.rename(file, `${file}.${id}.cleanup`);
  await fs.writeFile(file, "replacement");
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("changed");
  expect(await fs.readFile(`${file}.${id}.cleanup`, "utf8")).toBe("private resource");
  expect(await fs.readFile(file, "utf8")).toBe("replacement");
});
it("retains a changed staged artifact for operator recovery", async () => {
  const identity = await fixture(),
    file = path.join(root, key);
  await fs.rename(file, `${file}.${id}.cleanup`);
  await fs.writeFile(`${file}.${id}.cleanup`, "changed");
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("changed");
  expect(await fs.readFile(`${file}.${id}.cleanup`, "utf8")).toBe("changed");
});
it("restores a file swapped immediately before rename without deleting replacement bytes", async () => {
  const identity = await fixture(),
    realRename = fs.rename.bind(fs),
    file = path.join(root, key);
  vi.spyOn(fs, "rename").mockImplementationOnce(async (source, dest) => {
    await realRename(source, `${file}.original`);
    await fs.writeFile(file, "racing replacement");
    return realRename(source, dest);
  });
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("changed");
  expect(await fs.readFile(file, "utf8")).toBe("racing replacement");
  expect(await fs.readFile(`${file}.original`, "utf8")).toBe("private resource");
});
it("bounds directory windows and rejects traversal, noninteger and excessive offsets", async () => {
  await fs.mkdir(path.join(root, "assets/usr_test"), { recursive: true });
  for (let i = 0; i < 101; i++)
    await fs.writeFile(path.join(root, `assets/usr_test/unknown_${i}`), "ignored");
  const page = await provider.discoverAssetNamespace("usr_test", 0);
  expect(page.skipped).toBe(100);
  expect(page.nextOffset).toBe(100);
  expect((await provider.discoverAssetNamespace("usr_test", 100)).skipped).toBe(1);
  await expect(provider.discoverAssetNamespace("../escape", 0)).rejects.toThrow();
  for (const offset of [-1, 0.5, 10001])
    await expect(provider.listAssetNamespaces(offset)).rejects.toThrow();
});
it("honors cancellation before touching the object", async () => {
  const identity = await fixture(),
    controller = new AbortController();
  controller.abort();
  await expect(provider.removeMaintenanceObject(identity, id, controller.signal)).rejects.toThrow();
  expect(await fs.readFile(path.join(root, key), "utf8")).toBe("private resource");
});
it("keeps a staged object after cancellation and permits an exact retry", async () => {
  const identity = await fixture(),
    controller = new AbortController(),
    realRename = fs.rename.bind(fs);
  vi.spyOn(fs, "rename").mockImplementationOnce(async (source, dest) => {
    await realRename(source, dest);
    controller.abort();
  });
  await expect(provider.removeMaintenanceObject(identity, id, controller.signal)).rejects.toThrow();
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("deleted");
});
it("does not unlink a symlink replacement or its target", async () => {
  const identity = await fixture(),
    file = path.join(root, key),
    target = path.join(root, "outside");
  await fs.unlink(file);
  await fs.writeFile(target, "outside");
  await fs.symlink(target, file);
  await expect(provider.removeMaintenanceObject(identity, id)).rejects.toThrow();
  expect(await fs.readFile(target, "utf8")).toBe("outside");
  expect((await fs.lstat(file)).isSymbolicLink()).toBe(true);
});
it("retains exact staged bytes when unlink fails and safely retries", async () => {
  const identity = await fixture(),
    realUnlink = fs.unlink.bind(fs);
  vi.spyOn(fs, "unlink").mockImplementationOnce(async () => {
    throw new Error("Filesystem unavailable");
  });
  await expect(provider.removeMaintenanceObject(identity, id)).rejects.toThrow(
    "Filesystem unavailable",
  );
  expect(await fs.readFile(`${path.join(root, key)}.${id}.cleanup`, "utf8")).toBe(
    "private resource",
  );
  vi.mocked(fs.unlink).mockImplementation(realUnlink);
  expect(await provider.removeMaintenanceObject(identity, id)).toBe("deleted");
});
it("skips a canonical sparse object above the upload ceiling without reading it", async () => {
  await fs.mkdir(path.join(root, "assets/usr_test"), { recursive: true });
  const file = await fs.open(path.join(root, key), "w");
  try {
    await file.truncate(64 * 1024 * 1024 + 1);
  } finally {
    await file.close();
  }
  const page = await provider.discoverAssetNamespace("usr_test", 0);
  expect(page.objects).toEqual([]);
  expect(page.skipped).toBe(1);
});
