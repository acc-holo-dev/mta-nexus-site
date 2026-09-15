import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { StorageProvider, StorageObjectMeta } from "./types";

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir = "./uploads") {
    this.baseDir = path.resolve(baseDir);
  }

  private resolvePath(key: string): string {
    const safeKey = key.replace(/(\.\.[\/\\])+/g, "");
    return path.join(this.baseDir, safeKey);
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

  async get(key: string): Promise<{ stream: NodeJS.ReadableStream; meta?: Partial<StorageObjectMeta> }> {
    const filePath = this.resolvePath(key);
    const stat = await fs.stat(filePath);
    const stream = createReadStream(filePath);
    return {
      stream,
      meta: {
        key,
        sizeBytes: stat.size,
      },
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      await fs.unlink(filePath);
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedDownloadUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    return `/api/storage/download/${encodeURIComponent(key)}`;
  }
}
