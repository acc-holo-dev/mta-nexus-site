import crypto from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  isMaintenanceAssetKey,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  STORAGE_DISCOVERY_LIMIT,
  STORAGE_DISCOVERY_MAX_BYTES,
  STORAGE_DISCOVERY_MAX_OFFSET,
  type StorageObjectIdentity,
  type StorageRemovalResult,
} from "@nexus/domain";

type WithParent = <T>(
  key: string,
  create: boolean,
  operation: (filePath: string) => Promise<T>,
) => Promise<T>;
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === "ENOENT";
function bounds(offset: number) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > STORAGE_DISCOVERY_MAX_OFFSET)
    throw new RangeError("Invalid discovery offset");
}
/** Directory iteration has a fixed window and no recursive traversal or symlink following. */
async function window(directory: string, offset: number, signal?: AbortSignal) {
  bounds(offset);
  const limit = Math.min(STORAGE_DISCOVERY_LIMIT, STORAGE_DISCOVERY_MAX_OFFSET - offset);
  const entries: { name: string; directory: boolean; file: boolean }[] = [];
  let visited = 0,
    more = false;
  const dir = await fs.opendir(directory, { bufferSize: 32 });
  for await (const entry of dir) {
    signal?.throwIfAborted();
    if (visited++ < offset) continue;
    if (entries.length >= limit) {
      more = true;
      break;
    }
    entries.push({ name: entry.name, directory: entry.isDirectory(), file: entry.isFile() });
  }
  return {
    entries,
    nextOffset:
      more && offset + entries.length < STORAGE_DISCOVERY_MAX_OFFSET
        ? offset + entries.length
        : null,
    limited: more && offset + entries.length >= STORAGE_DISCOVERY_MAX_OFFSET,
  };
}
export async function listAssetNamespaces(
  parent: WithParent,
  offset: number,
  signal?: AbortSignal,
) {
  bounds(offset);
  try {
    return await parent("assets/_probe", false, async (file) => {
      const page = await window(path.dirname(file), offset, signal);
      return {
        owners: page.entries
          .filter((v) => v.directory && /^[A-Za-z0-9_-]{1,128}$/u.test(v.name))
          .map((v) => v.name),
        nextOffset: page.nextOffset,
        limited: page.limited,
      };
    });
  } catch (error) {
    if (missing(error)) return { owners: [], nextOffset: null, limited: false };
    throw error;
  }
}
async function inspectAt(
  file: string,
  key: string,
  signal?: AbortSignal,
  maxBytes = MAX_UPLOAD_FILE_SIZE_BYTES,
): Promise<StorageObjectIdentity> {
  signal?.throwIfAborted();
  const handle = await fs.open(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.nlink !== 1n ||
      before.size <= 0n ||
      before.size > BigInt(maxBytes)
    )
      throw new Error("Unsafe maintenance object");
    const hash = crypto.createHash("sha256"),
      buffer = Buffer.allocUnsafe(64 * 1024);
    let position = 0;
    while (position < Number(before.size)) {
      signal?.throwIfAborted();
      const { bytesRead } = await handle.read(
        buffer,
        0,
        Math.min(buffer.length, Number(before.size) - position),
        position,
      );
      if (!bytesRead) throw new Error("Maintenance object changed");
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      after.nlink !== 1n
    )
      throw new Error("Maintenance object changed");
    signal?.throwIfAborted();
    return {
      key,
      sizeBytes: Number(before.size),
      sha256Hash: hash.digest("hex"),
      modifiedAt: new Date(Number(before.mtimeMs)).toISOString(),
      device: String(before.dev),
      inode: String(before.ino),
      mtimeNs: String(before.mtimeNs),
      ctimeNs: String(before.ctimeNs),
    };
  } finally {
    await handle.close();
  }
}
export async function discoverAssetNamespace(
  parent: WithParent,
  ownerId: string,
  offset: number,
  signal?: AbortSignal,
) {
  bounds(offset);
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(ownerId)) throw new Error("Invalid asset namespace");
  try {
    return await parent(`assets/${ownerId}/_probe`, false, async (file) => {
      const page = await window(path.dirname(file), offset, signal),
        objects: StorageObjectIdentity[] = [];
      let skipped = 0,
        inspectedBytes = 0;
      for (const entry of page.entries) {
        signal?.throwIfAborted();
        const key = `assets/${ownerId}/${entry.name}`;
        if (!entry.file || !isMaintenanceAssetKey(key)) {
          skipped++;
          continue;
        }
        try {
          const target = path.join(path.dirname(file), entry.name),
            stat = await fs.lstat(target);
          if (stat.size > STORAGE_DISCOVERY_MAX_BYTES - inspectedBytes) {
            skipped++;
            continue;
          }
          const identity = await inspectAt(
            target,
            key,
            signal,
            Math.min(MAX_UPLOAD_FILE_SIZE_BYTES, STORAGE_DISCOVERY_MAX_BYTES - inspectedBytes),
          );
          inspectedBytes += identity.sizeBytes;
          objects.push(identity);
        } catch {
          signal?.throwIfAborted();
          skipped++;
        }
      }
      return { objects, skipped, nextOffset: page.nextOffset, limited: page.limited };
    });
  } catch (error) {
    if (missing(error)) return { objects: [], skipped: 0, nextOffset: null, limited: false };
    throw error;
  }
}
function same(a: StorageObjectIdentity, b: StorageObjectIdentity, renamed = false) {
  return (
    a.key === b.key &&
    a.device === b.device &&
    a.inode === b.inode &&
    a.sizeBytes === b.sizeBytes &&
    a.sha256Hash === b.sha256Hash &&
    a.mtimeNs === b.mtimeNs &&
    (renamed || a.ctimeNs === b.ctimeNs)
  );
}
/** The DB retirement barrier must have committed before invoking this operation. */
export async function removeMaintenanceObject(
  parent: WithParent,
  expected: StorageObjectIdentity,
  objectId: string,
  signal?: AbortSignal,
): Promise<StorageRemovalResult> {
  if (!isMaintenanceAssetKey(expected.key) || !/^smo_[a-f0-9]{24}$/u.test(objectId))
    throw new Error("Invalid maintenance identity");
  try {
    return await parent(expected.key, false, async (file) => {
      const stage = `${file}.${objectId}.cleanup`;
      const exists = async (target: string) => {
        try {
          await fs.lstat(target);
          return true;
        } catch (error) {
          if (missing(error)) return false;
          throw error;
        }
      };
      // A crash after the rename can resume using the same persistent object ID.
      if (await exists(stage)) {
        if (await exists(file)) return "changed";
        const staged = await inspectAt(stage, expected.key, signal);
        if (!same(staged, expected, true)) return "changed";
        signal?.throwIfAborted();
        await fs.unlink(stage);
        return "deleted";
      }
      let current: StorageObjectIdentity;
      try {
        current = await inspectAt(file, expected.key, signal);
      } catch (error) {
        if (missing(error)) return "missing";
        throw error;
      }
      if (!same(current, expected)) return "changed";
      signal?.throwIfAborted();
      await fs.rename(file, stage);
      // Errors or cancellation leave the staged object available for an exact retry.
      const captured = await inspectAt(stage, expected.key, signal);
      if (!same(captured, expected, true)) {
        // Restore without replacing a concurrent writer's newly created object.
        try {
          await fs.link(stage, file);
          await fs.unlink(stage);
        } catch {
          /* Preserve staged bytes for operator recovery. */
        }
        return "changed";
      }
      signal?.throwIfAborted();
      await fs.unlink(stage);
      return "deleted";
    });
  } catch (error) {
    if (missing(error)) return "missing";
    throw error;
  }
}
