import crypto from "node:crypto";
import path from "node:path";
import { getStorageProvider } from "./index";
import { generateId } from "@nexus/security";
import { ValidationError } from "@nexus/domain";
import type { StorageObjectMeta } from "./types";

const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB
const ALLOWED_EXTENSIONS = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".lua",
  ".luac",
  ".dff",
  ".txd",
  ".col",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".json",
  ".map",
]);

export class StorageService {
  async uploadAsset(input: {
    data: Buffer | Uint8Array;
    fileName: string;
    mimeType: string;
    userId: string;
    isPrivate?: boolean;
  }): Promise<StorageObjectMeta & { id: string }> {
    if (input.data.byteLength > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File exceeds maximum permitted size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`
      );
    }

    const ext = path.extname(input.fileName).toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      throw new ValidationError(`File type '${ext}' is not permitted in MTA Nexus storage`);
    }

    const sha256Hash = crypto.createHash("sha256").update(input.data).digest("hex");
    const id = generateId("ast");
    const sanitizedName = path.basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `assets/${input.userId}/${id}_${sanitizedName}`;

    const provider = getStorageProvider();
    const meta = await provider.put(key, input.data, input.mimeType);

    return {
      ...meta,
      id,
      sha256Hash,
      isPrivate: input.isPrivate ?? false,
    };
  }

  async getDownloadStream(key: string) {
    const provider = getStorageProvider();
    const exists = await provider.exists(key);
    if (!exists) {
      throw new ValidationError("Asset does not exist in storage");
    }
    return provider.get(key);
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const provider = getStorageProvider();
    return provider.getSignedDownloadUrl(key, expiresInSeconds);
  }
}

export const storageService = new StorageService();
