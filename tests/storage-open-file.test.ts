import { mkdtemp, rm, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { afterEach, beforeEach, expect, it } from "vitest";
import { LocalStorageProvider } from "../packages/storage/src/local-provider";

let root: string;
let storage: LocalStorageProvider;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "nexus-open-"));
  storage = new LocalStorageProvider(root);
});
afterEach(async () => {
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
});

it("rejects a missing file before returning a stream", async () => {
  await expect(storage.get("missing.zip")).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects directories as download objects", async () => {
  await expect(storage.get(".")).rejects.toThrow("regular file");
});
