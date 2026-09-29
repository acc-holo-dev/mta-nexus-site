import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
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
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);

    const hash = crypto.createHash("sha256").update(data).digest("hex");

    return {
      key,
      sizeBytes: data.byteLength,
      mimeType,
      sha256Hash: hash,
      isPrivate: false,
      uploadedAt: new Date(),
    };
  }

  async get(
    key: string,
  ): Promise<{ stream: NodeJS.ReadableStream; meta?: Partial<StorageObjectMeta> }> {
    const filePath = this.resolvePath(key);
    const handle = await fs.open(filePath, "r");
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error("Storage object is not a regular file");
      return { stream: handle.createReadStream(), meta: { key, sizeBytes: stat.size } };
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
