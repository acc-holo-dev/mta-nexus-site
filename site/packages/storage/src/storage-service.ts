import crypto from "node:crypto";
import path from "node:path";
import { getStorageProvider } from "./provider-factory";
import { generateId } from "@nexus/security";
import {
  MAX_UPLOAD_FILE_SIZE_BYTES,
  ValidationError,
  isAllowedResourceUploadExtension,
} from "@nexus/domain";
import type { StorageObjectMeta } from "./types";

export const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_BYTES;

export class StorageService {
  async uploadAsset(input: {
    data: Buffer | Uint8Array;
    fileName: string;
    mimeType: string;
    userId: string;
    isPrivate?: boolean;
  }): Promise<StorageObjectMeta & { id: string }> {
    if (input.data.byteLength === 0) {
      throw new ValidationError("Empty files are not permitted");
    }
    if (input.data.byteLength > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File exceeds maximum permitted size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    const ext = path.extname(input.fileName).toLowerCase();
    if (!ext || !isAllowedResourceUploadExtension(ext)) {
      throw new ValidationError(
        ext
          ? `File type '${ext}' is not permitted in MTA Nexus storage`
          : "A permitted file extension is required",
      );
    }

    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(input.userId)) {
      throw new ValidationError("Invalid storage owner identifier");
    }

    const sha256Hash = crypto.createHash("sha256").update(input.data).digest("hex");
    const id = generateId("ast");
    // Original names belong in build metadata, not filesystem components.
    // A generated key leaves room for the atomic writer's temporary suffix.
    const key = `assets/${input.userId}/${id}${ext}`;

    const provider = getStorageProvider();
    const meta = await provider.put(key, input.data, input.mimeType);
    // A storage adapter must acknowledge the exact immutable object that
    // was requested. A successful write with a different key, length or
    // digest must not be published as a valid upload in database metadata.
    if (
      meta.key !== key ||
      meta.sizeBytes !== input.data.byteLength ||
      meta.sha256Hash !== sha256Hash
    ) {
      // Best effort: this key was freshly generated and put() is required to
      // publish only new keys. Do not hide the integrity failure if cleanup
      // is unavailable or the adapter itself is malfunctioning.
      try {
        await provider.delete(key);
      } catch {
        // The orphaned object needs a separate storage maintenance sweep.
      }
      throw new ValidationError("Storage provider did not confirm uploaded asset integrity");
    }

    return {
      ...meta,
      id,
      sha256Hash,
      isPrivate: input.isPrivate ?? false,
    };
  }

  async deleteAsset(key: string): Promise<void> {
    const provider = getStorageProvider();
    await provider.delete(key);
  }

  async getDownloadStream(key: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const provider = getStorageProvider();
    // An exists()-then-get() pair doubles I/O and is vulnerable to a rename
    // between both calls. Opening the object is the authoritative check.
    try {
      const opened = await provider.get(key, signal);
      // Storage providers can finish preparing a stream concurrently with
      // request cancellation. Reject after the await and destroy a stream
      // already returned by the adapter rather than leaking live handles.
      try {
        signal?.throwIfAborted();
        // Raw download callers may not have a build row to compare against.
        // The provider must at least return a metadata record for the exact
        // requested object with bounded size and a canonical digest.
        const meta = opened.meta;
        if (
          meta?.key !== key ||
          !Number.isSafeInteger(meta?.sizeBytes) ||
          meta.sizeBytes <= 0 ||
          meta.sizeBytes > MAX_FILE_SIZE_BYTES ||
          !/^[a-f0-9]{64}$/u.test(meta.sha256Hash)
        ) {
          throw new ValidationError("Storage provider returned invalid verified metadata");
        }
      } catch (error) {
        (
          opened.stream as NodeJS.ReadableStream & {
            destroy?: () => void;
          }
        ).destroy?.();
        throw error;
      }
      return opened;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new ValidationError("Asset does not exist in storage");
      }
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const provider = getStorageProvider();
    return provider.getSignedDownloadUrl(key, expiresInSeconds);
  }
}

export const storageService = new StorageService();
