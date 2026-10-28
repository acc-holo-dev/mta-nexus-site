import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { link, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Container runtime readiness. Keep storage probing internal to the container; do not expand the public health API.
export async function checkLocalReadiness({
  storagePath = process.env.STORAGE_LOCAL_PATH,
  fetchFn = globalThis.fetch,
  linkFn = link,
} = {}) {
  assert(storagePath && isAbsolute(storagePath), "An absolute storage path is required");
  const response = await fetchFn("http://127.0.0.1:3000/api/health", {
    signal: AbortSignal.timeout(8_000),
  });
  assert.equal(response.status, 200, "Application/database is not ready");
  const health = await response.json();
  assert.equal(health.status, "ok", "Unexpected health status");
  assert.equal(health.database, "reachable", "Database is not reachable");

  // This checks the actual mounted directory as the app user, not only its existence.
  // Only this uniquely created probe directory can be deleted by this check.
  const directory = await mkdtemp(join(storagePath, ".nexus-readiness-"));
  try {
    const value = randomUUID();
    const file = join(directory, "probe");
    await writeFile(file, value, { flag: "wx", mode: 0o600 });
    assert.equal(await readFile(file, "utf8"), value, "Storage read/write failed");
    // LocalStorageProvider publishes using link(), so read/write alone is not
    // enough to establish that this mounted filesystem supports uploads.
    const published = join(directory, "published");
    await linkFn(file, published);
    await assert.rejects(
      linkFn(file, published),
      { code: "EEXIST" },
      "Storage must reject replacement of an already published key",
    );
    await unlink(file);
    assert.equal(
      await readFile(published, "utf8"),
      value,
      "Published storage bytes must survive staging-file removal",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  return {
    status: "ok",
    database: "reachable",
    storage: "read-write",
    publication: "atomic-no-replace",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await checkLocalReadiness()));
  } catch (error) {
    console.error(`Local readiness failed: ${error.message}`);
    process.exitCode = 1;
  }
}
