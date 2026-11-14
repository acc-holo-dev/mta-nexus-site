import { rm } from "node:fs/promises";

/** Do not let an in-flight atomic rename restore a ready snapshot after cleanup. */
export async function cleanupWorkerHealth(
  writing: Promise<unknown>,
  temporary: string,
  healthFile: string,
): Promise<void> {
  try {
    await writing;
  } finally {
    await rm(temporary, { force: true });
    await rm(healthFile, { force: true });
  }
}
