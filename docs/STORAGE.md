# MTA NEXUS 1.1 — Storage Abstraction Specification

## 1. Provider Architecture
Application code interacts through the `StorageService` (`packages/storage/src/storage-service.ts`) and `StorageProvider` abstraction:
- **LocalStorageProvider:** Local filesystem adapter with directory isolation and path-traversal prevention.
- **S3StorageProvider:** S3/MinIO compatible object storage adapter.

## 2. Integrity Verification
- **SHA-256 Checksum:** Calculated on every uploaded asset buffer and persisted alongside metadata.
- **File Limits:** 64MB maximum stored asset size; build upload multipart requests allow only a bounded 1MB envelope above that before parsing.
- **Extension Allowlist:** `.zip`, `.rar`, `.7z`, `.lua`, `.luac`, `.dff`, `.txd`, `.col`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.json`, `.map`.

## 3. Entitlement-Based Downloads
Private resource builds and assets require verification through `entitlementRepository.hasEntitlement(user, resourceId, "product.download")` before generating signed URLs or streaming chunks.


## 4. Resource build scanning

Resource build uploads perform extension/signature checks and malware scanning before private storage.

Production configuration requires ClamAV. A clean scanner verdict is required before moderation can approve a build.

Verdict handling:

- clean: store privately and submit for moderation;
- malicious: reject before storage;
- scanner error/timeout/protocol failure: return a retryable service error before storage;
- disabled/not-scanned: explicit non-production/manual state only, never equivalent to clean.

ClamAV INSTREAM upload uses bounded 64 KiB chunks and respects socket backpressure.
