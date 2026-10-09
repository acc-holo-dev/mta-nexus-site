import type { UploadStatus } from "@nexus/domain";

export interface StorageObjectMeta {
  key: string;
  sizeBytes: number;
  mimeType: string;
  sha256Hash: string;
  isPrivate: boolean;
  uploadedAt: Date;
}

/**
 * Storage adapters must verify actual file metadata before permitting delivery.
 * Remote providers cannot merely echo database claims into this structure.
 */
export type VerifiedStorageReadMeta =
  Pick<StorageObjectMeta, "key" | "sizeBytes" | "sha256Hash"> &
  Partial<StorageObjectMeta>;

export interface StorageProvider {
  /** Publish a new immutable key. Existing keys must never be overwritten. */
  put(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<StorageObjectMeta>;
  /** Cancellation must stop preparation and release the opened stream. */
  get(key: string, signal?: AbortSignal): Promise<{ stream: NodeJS.ReadableStream; meta: VerifiedStorageReadMeta }>;
  delete(key: string): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}

export interface UploadRecord {
  id: string;
  key: string;
  userId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  status: UploadStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
