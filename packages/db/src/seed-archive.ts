import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

// Deterministic ZIP_STORED fixture: README.txt and meta.xml, dated 2026-01-01.
// No executable scripts or advertised product implementation are included.
const archive = Buffer.from(
  "UEsDBBQAAAAAAAAAIVz1kHfjugAAALoAAAAKAAAAUkVBRE1FLnR4dE1UQSBORVhVUyBkZXZlbG9wbWVudCBmaXh0dXJlClRoaXMgYXJjaGl2ZSB0ZXN0cyBjbGFpbWluZyBhbmQgZG93bmxvYWRpbmcgb25seS4KSXQgZG9lcyBub3QgY29udGFpbiB0aGUgYWR2ZXJ0aXNlZCBpbnZlbnRvcnkgc3lzdGVtLgpEbyBub3QgZGVwbG95IHRoaXMgZml4dHVyZSBhcyBhIHByb2R1Y3Rpb24gcmVzb3VyY2UuClBLAwQUAAAAAAAAACFcN04jTWQAAABkAAAACAAAAG1ldGEueG1sPG1ldGE+CiAgPGluZm8gbmFtZT0iTmV4dXMgZG93bmxvYWQgZGVtbyIgYXV0aG9yPSJNVEEgTkVYVVMiIHZlcnNpb249IjEuMC4wIiB0eXBlPSJtaXNjIiAvPgo8L21ldGE+ClBLAQIUAxQAAAAAAAAAIVz1kHfjugAAALoAAAAKAAAAAAAAAAAAAACAAQAAAABSRUFETUUudHh0UEsBAhQDFAAAAAAAAAAhXDdOI01kAAAAZAAAAAgAAAAAAAAAAAAAAIAB4gAAAG1ldGEueG1sUEsFBgAAAAACAAIAbgAAAGwBAAAAAA==",
  "base64",
);

export async function ensureSeedArchive(options: {
  NODE_ENV: string;
  STORAGE_PROVIDER: string;
  STORAGE_LOCAL_PATH: string;
}) {
  if (options.NODE_ENV === "production") {
    throw new Error("Demonstration seed is disabled in production");
  }
  if (options.STORAGE_PROVIDER !== "local" || !isAbsolute(options.STORAGE_LOCAL_PATH)) {
    throw new Error(
      "Seed requires local storage with an absolute STORAGE_LOCAL_PATH shared with the app",
    );
  }

  const storageKey = "builds/prd_inv_pro/v3.2.0.zip";
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
