import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageProvider } from "../packages/storage/src/local-provider";

let root: string;
let outside: string;
let provider: LocalStorageProvider;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(tmpdir(), "nexus-storage-secure-"));
  outside = await fs.mkdtemp(path.join(tmpdir(), "nexus-storage-outside-"));
  provider = new LocalStorageProvider(root);
  await fs.writeFile(path.join(outside, "secret.zip"), "outside confidential bytes");
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(outside, { recursive: true, force: true });
});

describe("local storage symlink confinement", () => {
  it("denies symlinked and dangling parent directories in every operation", async () => {
    await fs.symlink(outside, path.join(root, "outside"));
    await fs.symlink(path.join(outside, "missing"), path.join(root, "dangling"));
    for (const dir of ["outside", "dangling"]) {
      await expect(
        provider.put(`${dir}/attack.zip`, Buffer.from("attack"), "application/zip"),
      ).rejects.toThrow();
      await expect(provider.get(`${dir}/secret.zip`)).rejects.toThrow();
      await expect(provider.exists(`${dir}/secret.zip`)).rejects.toThrow();
      await expect(provider.delete(`${dir}/secret.zip`)).rejects.toThrow();
    }
    expect(await fs.readFile(path.join(outside, "secret.zip"), "utf8")).toBe(
      "outside confidential bytes",
    );
    expect(await fs.readdir(outside)).toEqual(["secret.zip"]);
  });

  it("rejects leaf symlinks for get, exists, delete and immutable put", async () => {
    await fs.symlink(path.join(outside, "secret.zip"), path.join(root, "alias.zip"));
    await expect(provider.get("alias.zip")).rejects.toThrow();
    await expect(provider.exists("alias.zip")).rejects.toThrow("Symbolic-link");
    await expect(provider.delete("alias.zip")).rejects.toThrow("Symbolic-link");
    await expect(
      provider.put("alias.zip", Buffer.from("overwrite"), "application/zip"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await fs.readFile(path.join(outside, "secret.zip"), "utf8")).toBe(
      "outside confidential bytes",
    );
  });

  it("rejects cross-boundary hard links", async () => {
    await fs.link(path.join(outside, "secret.zip"), path.join(root, "hard.zip"));
    await expect(provider.get("hard.zip")).rejects.toThrow("Hard-linked");
    await expect(provider.exists("hard.zip")).rejects.toThrow("Hard-linked");
    await expect(provider.delete("hard.zip")).rejects.toThrow("Hard-linked");
    expect(await fs.readFile(path.join(outside, "secret.zip"), "utf8")).toBe(
      "outside confidential bytes",
    );
  });

  it("does not accept a symlink as the storage root", async () => {
    await fs.symlink(outside, path.join(root, "root-link"));
    const unsafe = new LocalStorageProvider(path.join(root, "root-link"));
    await expect(unsafe.put("attack.zip", Buffer.from("x"), "application/zip")).rejects.toThrow();
    await expect(unsafe.get("secret.zip")).rejects.toThrow();
    await expect(unsafe.exists("secret.zip")).rejects.toThrow();
  });

  it("blocks traversal and Windows-style paths", async () => {
    for (const key of [
      "../outside/attack.zip",
      "a/../attack.zip",
      "C:\\Windows\\secret.zip",
      "a\\b.zip",
      "a//b.zip",
    ]) {
      await expect(provider.put(key, Buffer.from("x"), "application/zip")).rejects.toThrow();
    }
    expect(await fs.readdir(root)).toEqual([]);
  });

  it("pins parent descriptor if another writer replaces the parent with a symlink", async () => {
    await fs.mkdir(path.join(root, "inside"));
    const originalOpen = fs.open.bind(fs);
    let swapped = false;
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      const handle = await originalOpen(...args);
      if (!swapped && String(args[0]).endsWith("/inside")) {
        swapped = true;
        await fs.rename(path.join(root, "inside"), path.join(root, "pinned"));
        await fs.symlink(outside, path.join(root, "inside"));
      }
      return handle;
    });
    await provider.put("inside/archive.zip", Buffer.from("safe"), "application/zip");
    expect(swapped).toBe(true);
    expect(await fs.readFile(path.join(root, "pinned", "archive.zip"), "utf8")).toBe("safe");
    expect(await fs.readdir(outside)).toEqual(["secret.zip"]);
  });

  it("does not follow a file swapped to a symlink immediately before open", async () => {
    await provider.put("archive.zip", Buffer.from("original"), "application/zip");
    const originalOpen = fs.open.bind(fs);
    let swapped = false;
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      if (!swapped && String(args[0]).endsWith("/archive.zip")) {
        swapped = true;
        await fs.rename(path.join(root, "archive.zip"), path.join(root, "original.zip"));
        await fs.symlink(path.join(outside, "secret.zip"), path.join(root, "archive.zip"));
      }
      return originalOpen(...args);
    });
    await expect(provider.get("archive.zip")).rejects.toThrow();
    expect(swapped).toBe(true);
    expect(await fs.readFile(path.join(outside, "secret.zip"), "utf8")).toBe(
      "outside confidential bytes",
    );
  });

  it("keeps regular nested upload, get and delete working", async () => {
    const created = await provider.put(
      "assets/user/archive.zip",
      Buffer.from("safe"),
      "application/zip",
    );
    expect(await provider.exists(created.key)).toBe(true);
    const opened = await provider.get(created.key);
    const chunks: Buffer[] = [];
    for await (const chunk of opened.stream as AsyncIterable<Buffer>)
      chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("safe");
    await provider.delete(created.key);
    expect(await provider.exists(created.key)).toBe(false);
  });

  it("releases all pinned directories after an upload and after a denied symlink", async () => {
    const opened: Array<Awaited<ReturnType<typeof fs.open>>> = [];
    const originalOpen = fs.open.bind(fs);
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      const handle = await originalOpen(...args);
      if ((await handle.stat()).isDirectory()) opened.push(handle);
      return handle;
    });

    await provider.put("nested/inside/asset.zip", Buffer.from("safe"), "application/zip");
    await fs.symlink(outside, path.join(root, "linked"));
    await expect(provider.get("linked/secret.zip")).rejects.toThrow();

    expect(opened.length).toBeGreaterThanOrEqual(4);
    for (const handle of opened) {
      expect(handle.fd).toBe(-1);
      await expect(handle.stat()).rejects.toMatchObject({ code: "EBADF" });
    }
    expect(await fs.readdir(outside)).toEqual(["secret.zip"]);
  });
});
