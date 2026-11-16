import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

// Deterministic ZIP_STORED fixture: README.txt and meta.xml, dated 2026-01-01.
// No executable scripts or advertised product implementation are included.
const archive = Buffer.from(
  "UEsDBBQAAAAAAAAAIVz1kHfjugAAALoAAAAKAAAAUkVBRE1FLnR4dE1UQSBORVhVUyBkZXZlbG9wbWVudCBmaXh0dXJlClRoaXMgYXJjaGl2ZSB0ZXN0cyBjbGFpbWluZyBhbmQgZG93bmxvYWRpbmcgb25seS4KSXQgZG9lcyBub3QgY29udGFpbiB0aGUgYWR2ZXJ0aXNlZCBpbnZlbnRvcnkgc3lzdGVtLgpEbyBub3QgZGVwbG95IHRoaXMgZml4dHVyZSBhcyBhIHByb2R1Y3Rpb24gcmVzb3VyY2UuClBLAwQUAAAAAAAAACFcN04jTWQAAABkAAAACAAAAG1ldGEueG1sPG1ldGE+CiAgPGluZm8gbmFtZT0iTmV4dXMgZG93bmxvYWQgZGVtbyIgYXV0aG9yPSJNVEEgTkVYVVMiIHZlcnNpb249IjEuMC4wIiB0eXBlPSJtaXNjIiAvPgo8L21ldGE+ClBLAQIUAxQAAAAAAAAAIVz1kHfjugAAALoAAAAKAAAAAAAAAAAAAACAAQAAAABSRUFETUUudHh0UEsBAhQDFAAAAAAAAAAhXDdOI01kAAAAZAAAAAgAAAAAAAAAAAAAAIAB4gAAAG1ldGEueG1sUEsFBgAAAAACAAIAbgAAAGwBAAAAAA==",
  "base64",
);

type SeedStorageOptions = {
  NODE_ENV: string;
  STORAGE_PROVIDER: string;
  STORAGE_LOCAL_PATH: string;
};

function validateSeedStorage(options: SeedStorageOptions) {
  if (options.NODE_ENV === "production") {
    throw new Error("Demonstration seed is disabled in production");
  }
  if (options.STORAGE_PROVIDER !== "local" || !isAbsolute(options.STORAGE_LOCAL_PATH)) {
    throw new Error(
      "Seed requires local storage with an absolute STORAGE_LOCAL_PATH shared with the app",
    );
  }
}

async function ensureArchive(options: SeedStorageOptions, storageKey: string, archive: Buffer) {
  validateSeedStorage(options);
  const target = join(options.STORAGE_LOCAL_PATH, storageKey);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, archive, { flag: "wx", mode: 0o600 });
  try {
    try {
      // Publish only a complete file, without replacing an existing download.
      await link(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (!(await readFile(target)).equals(archive)) {
        throw new Error("Seed archive conflicts with an existing file; inspect it before retrying");
      }
    }
  } finally {
    await unlink(temporary);
  }

  return {
    storageKey,
    sha256Hash: createHash("sha256").update(archive).digest("hex"),
    fileSizeBytes: archive.length,
  };
}

const driftArchive = Buffer.from(
  "UEsDBBQAAAAAAAAAIVzbjvAjkAAAAJAAAAAKAAAAUkVBRE1FLnR4dE1UQSBORVhVUyBkZXZlbG9wbWVudCBmaXh0dXJlCkRvd25sb2FkIGRlbW8gb25seSwgbm90IGEgZnVuY3Rpb25pbmcgZHJpZnQgaGFuZGxpbmcgc3lzdGVtLgpEbyBub3QgZGVwbG95IHRoaXMgZml4dHVyZSBhcyBhIHByb2R1Y3Rpb24gcmVzb3VyY2UuClBLAwQUAAAAAAAAACFcU77Os2oAAABqAAAACAAAAG1ldGEueG1sPG1ldGE+CiAgPGluZm8gbmFtZT0iTmV4dXMgZHJpZnQgZG93bmxvYWQgZGVtbyIgYXV0aG9yPSJNVEEgTkVYVVMiIHZlcnNpb249IjEuMC4wIiB0eXBlPSJtaXNjIiAvPgo8L21ldGE+ClBLAQIUAxQAAAAAAAAAIVzbjvAjkAAAAJAAAAAKAAAAAAAAAAAAAACAAQAAAABSRUFETUUudHh0UEsBAhQDFAAAAAAAAAAhXFO+zrNqAAAAagAAAAgAAAAAAAAAAAAAAIABuAAAAG1ldGEueG1sUEsFBgAAAAACAAIAbgAAAEgBAAAAAA==",
  "base64",
);

export function ensureSeedArchive(options: SeedStorageOptions) {
  return ensureArchive(options, "builds/prd_inv_pro/v3.2.0.zip", archive);
}

export async function ensureSeedArchives(options: SeedStorageOptions) {
  const inventory = await ensureSeedArchive(options);
  const drift = await ensureArchive(options, "builds/prd_drift_physics/v2.1.4.zip", driftArchive);
  return { inventory, drift };
}
