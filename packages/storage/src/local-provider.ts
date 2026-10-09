import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ConflictError } from "@nexus/domain";
import type { StorageProvider, StorageObjectMeta } from "./types";

type DirectoryHandle = Awaited<ReturnType<typeof fs.open>>;

/** Local storage must never resolve an asset key through a symbolic link. */
export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor(baseDir = "./uploads") {
    this.baseDir = path.resolve(baseDir);
  }

  private resolvePath(key: string): string {
    if (
      !key || key.includes("\0") || key.includes("\\") ||
      path.isAbsolute(key) || path.win32.isAbsolute(key)
    ) {
      throw new Error("Invalid storage key");
    }
    const resolved = path.resolve(this.baseDir, key);
    const relative = path.relative(this.baseDir, resolved);
    if (
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    ) {
      throw new Error("Storage key escapes the configured storage directory");
    }
    const parts = key.split("/");
    if (!relative || parts.some(part => !part || part === "." || part === "..")) {
      throw new Error("Invalid storage key");
    }
    return resolved;
  }

  /**
   * Child paths are resolved through a pinned directory descriptor. On Linux
   * /proc/self/fd keeps intermediate ancestors stable when their pathnames
   * are replaced by a symlink between operations. A leaf is opened NOFOLLOW.
   * The configured root and its parent directory remain deployment-trusted.
   */
  private entryPath(parent: DirectoryHandle, name: string): string {
    const fdRoot = process.platform === "darwin" ? "/dev/fd" : "/proc/self/fd";
    return fdRoot + "/" + parent.fd + "/" + name;
  }

  private async withParent<T>(
    key: string,
    createParents: boolean,
    operation: (filePath: string) => Promise<T>,
  ): Promise<T> {
    const resolved = this.resolvePath(key);
    const parts = path.relative(this.baseDir, resolved).split(path.sep);
    const leaf = parts.pop()!;
    if (!fsConstants.O_NOFOLLOW || !fsConstants.O_DIRECTORY) {
      throw new Error("Secure local storage requires directory and no-follow filesystem support");
    }
    if (createParents) await fs.mkdir(this.baseDir, { recursive: true, mode: 0o700 });
    const directoryFlags = fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW;
    const handles: DirectoryHandle[] = [];
    try {
      let current = await fs.open(this.baseDir, directoryFlags);
      handles.push(current);
      for (const part of parts) {
        const entry = this.entryPath(current, part);
        if (createParents) {
          try {
            await fs.mkdir(entry, { mode: 0o700 });
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          }
        }
        current = await fs.open(entry, directoryFlags);
        handles.push(current);
      }
      return await operation(this.entryPath(current, leaf));
    } finally {
      for (const handle of handles.reverse()) await handle.close();
    }
  }

  async put(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<StorageObjectMeta> {
    // Snapshot caller-owned memory before yielding, then publish complete bytes only.
    const bytes = Buffer.from(data);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    return this.withParent(key, true, async filePath => {
      const temporary = filePath + "." + crypto.randomUUID() + ".tmp";
      const handle = await fs.open(
        temporary,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
        0o600,
      );
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
    });
  }

  async get(
    key: string,
    signal?: AbortSignal,
  ): Promise<{ stream: NodeJS.ReadableStream; meta?: Partial<StorageObjectMeta> }> {
    signal?.throwIfAborted();
    return this.withParent(key, false, async filePath => {
      // NOFOLLOW rejects a leaf symlink, even if it is swapped just before open.
      // NONBLOCK avoids waiting on a hostile FIFO before its type can be checked.
      const handle = await fs.open(
        filePath,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK,
      );
      try {
        signal?.throwIfAborted();
        const stat = await handle.stat();
        if (!stat.isFile()) throw new Error("Storage object is not a regular file");
        if (stat.nlink !== 1) throw new Error("Hard-linked storage objects are forbidden");
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
    });
  }

  async delete(key: string): Promise<void> {
    try {
      await this.withParent(key, false, async filePath => {
        const stat = await fs.lstat(filePath);
        if (stat.isSymbolicLink()) throw new Error("Symbolic-link storage objects are forbidden");
        if (!stat.isFile()) throw new Error("Storage object is not a regular file");
        if (stat.nlink !== 1) throw new Error("Hard-linked storage objects are forbidden");
        await fs.unlink(filePath);
      });
    } catch (error: unknown) {
      if (!(error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT")) {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return await this.withParent(key, false, async filePath => {
        const stat = await fs.lstat(filePath);
        if (stat.isSymbolicLink()) throw new Error("Symbolic-link storage objects are forbidden");
        if (!stat.isFile()) return false;
        if (stat.nlink !== 1) throw new Error("Hard-linked storage objects are forbidden");
        return true;
      });
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
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
