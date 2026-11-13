import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { cleanupWorkerHealth } from "../../site/packages/db/scripts/worker-health-cleanup";

it("waits for an in-flight health rename before removing the snapshot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexus-health-cleanup-"));
  const temporary = join(directory, "health.tmp");
  const healthFile = join(directory, "health.json");
  try {
    await writeFile(temporary, '{"status":"ready"}');
    let release!: () => void;
    const writing = new Promise<void>((resolve) => {
      release = resolve;
    }).then(() => rename(temporary, healthFile));
    let cleaned = false;
    const cleanup = cleanupWorkerHealth(writing, temporary, healthFile).then(() => {
      cleaned = true;
    });
    await Promise.resolve();
    expect(cleaned).toBe(false);
    release();
    await cleanup;
    await expect(readFile(healthFile)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(temporary)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("removes health files and propagates a failed write without hanging", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexus-health-cleanup-error-"));
  const temporary = join(directory, "health.tmp");
  const healthFile = join(directory, "health.json");
  try {
    await writeFile(temporary, "partial");
    await writeFile(healthFile, '{"status":"ready"}');
    await expect(
      cleanupWorkerHealth(Promise.reject(new Error("write failed")), temporary, healthFile),
    ).rejects.toThrow("write failed");
    await expect(readFile(healthFile)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(temporary)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
