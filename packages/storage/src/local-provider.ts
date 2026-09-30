import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ConflictError } from "@nexus/domain";
import type { StorageProvider, StorageObjectMeta } from "./types";

export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor(baseDir = "./uploads") {
    this.baseDir = path.resolve(baseDir);
  }

  private resolvePath(key: string): string {
    if (!key || key.includes("\0") || path.isAbsolute(key)) {
      throw new Error("Invalid storage key");
    }

    const resolved = path.resolve(this.baseDir, key);
    const relative = path.relative(this.baseDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Storage key escapes the configured storage directory");
    }

    return resolved;
  }

  async put(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<StorageObjectMeta> {
    const filePath = this.resolvePath(key);
    // Snapshot caller-owned memory before yielding, then publish complete bytes only.
    const bytes = Buffer.from(data);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        // A hard link is atomic and cannot replace a previously published key.
        await fs.link(temporary, filePath);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "EEXIST") {
          throw new ConflictError("Storage key already exists; upload under a new key");
        }
        throw error;
      }
    } finally {
      await fs.unlink(temporary);
    }

    return {
      key,
      sizeBytes: bytes.byteLength,
      mimeType,
      sha256Hash: hash,
      isPrivate: false,
      uploadedAt: new Date(),
    };
  }

  async get(
    key: string,
    signal?: AbortSignal,
  ): Promise<{ stream: NodeJS.ReadableStream; meta?: Partial<StorageObjectMeta> }> {
    signal?.throwIfAborted();
    const filePath = this.resolvePath(key);
    const handle = await fs.open(filePath, "r");
    try {
      signal?.throwIfAborted();
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error("Storage object is not a regular file");
      // Bounded memory: hash the opened file before any response/audit is produced.
      // Positional reads leave the stream offset at zero and keep pathname races out.
      const hash = crypto.createHash("sha256");
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let position = 0;
      while (position < stat.size) {
        signal?.throwIfAborted();
        const { bytesRead } = await handle.read(
          buffer,
          0,
          Math.min(buffer.length, stat.size - position),
          position,
        );
        signal?.throwIfAborted();
        if (bytesRead === 0) throw new Error("Storage object changed while reading");
        hash.update(buffer.subarray(0, bytesRead));
        position += bytesRead;
      }
      const after = await handle.stat();
      if (
        after.size !== stat.size ||
        after.mtimeMs !== stat.mtimeMs ||
        after.ctimeMs !== stat.ctimeMs
      ) {
        throw new Error("Storage object changed while reading");
      }
      signal?.throwIfAborted();
      const stream = handle.createReadStream({ start: 0 });
      // Cancellation during the audit await must not emit an unhandled error.
      // The route rechecks the signal before auditing/returning a response.
      if (signal) {
        const abort = () => stream.destroy();
        signal.addEventListener("abort", abort, { once: true });
        stream.once("close", () => signal.removeEventListener("abort", abort));
      }
      return {
        stream,
        meta: { key, sizeBytes: stat.size, sha256Hash: hash.digest("hex") },
      };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        )
      ) {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return false;
      }
      throw error;
    }
  }

  async getSignedDownloadUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    this.resolvePath(key);
    return `/api/storage/download/${encodeURIComponent(key)}`;
  }
}
