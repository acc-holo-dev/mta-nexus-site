import { describe, it, expect, afterAll } from "vitest";
import { LocalStorageProvider } from "@nexus/storage";
import fs from "node:fs/promises";
import path from "node:path";

describe("Storage Abstraction & Integrity", () => {
  const testDir = "./tmp-test-storage";
  const provider = new LocalStorageProvider(testDir);

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should upload a binary buffer, compute valid SHA-256 hash and verify presence", async () => {
    const payload = Buffer.from("Multi Theft Auto Nexus Resource Archive Content");
    const meta = await provider.put("resources/test-pkg.zip", payload, "application/zip");

    expect(meta.key).toBe("resources/test-pkg.zip");
    expect(meta.sizeBytes).toBe(payload.length);
    expect(meta.sha256Hash).toHaveLength(64);

    const exists = await provider.exists("resources/test-pkg.zip");
    expect(exists).toBe(true);

    await provider.delete("resources/test-pkg.zip");
    const stillExists = await provider.exists("resources/test-pkg.zip");
    expect(stillExists).toBe(false);
  });
});
