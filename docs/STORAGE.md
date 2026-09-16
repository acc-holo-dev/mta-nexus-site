# MTA NEXUS 1.1 — Storage Abstraction Specification

## 1. Provider Architecture
Application code interacts through the `StorageService` (`packages/storage/src/storage-service.ts`) and `StorageProvider` abstraction:
- **LocalStorageProvider:** Local filesystem adapter with directory isolation and path-traversal prevention.
- **S3StorageProvider:** S3/MinIO compatible object storage adapter.

## 2. Integrity Verification
- **SHA-256 Checksum:** Calculated on every uploaded asset buffer and persisted alongside metadata.
- **File Limits:** 250MB maximum asset size per archive.
- **Extension Allowlist:** `.zip`, `.rar`, `.7z`, `.lua`, `.luac`, `.dff`, `.txd`, `.col`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.json`, `.map`.

## 3. Entitlement-Based Downloads
Private resource builds and assets require verification through `entitlementRepository.hasEntitlement(user, resourceId, "product.download")` before generating signed URLs or streaming chunks.
