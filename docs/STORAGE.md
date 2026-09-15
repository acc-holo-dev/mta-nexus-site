# MTA NEXUS — Storage Abstraction Specification

## 1. Provider Design
Developers never interact directly with underlying storage backends (AWS S3, MinIO, or Local Disk). All file management utilizes the `@nexus/storage` abstraction:

```ts
export interface StorageProvider {
  put(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<StorageObjectMeta>;
  get(key: string): Promise<{ stream: NodeJS.ReadableStream; meta?: Partial<StorageObjectMeta> }>;
  delete(key: string): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}
```

## 2. Upload State Machine
All asset uploads transition through a strict pipeline:
`initiated -> uploading -> uploaded -> validating -> processing -> ready -> quarantined -> failed -> deleted`

## 3. Cryptographic Verification
Every uploaded build archive generates a SHA-256 hash. The hash is recorded in `builds.sha256_hash` and verified before client download to guarantee binary integrity.
