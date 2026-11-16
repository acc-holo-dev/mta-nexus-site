/** Storage grace is unrelated to financial holds or license terms. */
export const STORAGE_ORPHAN_GRACE_DAYS = 7;
export const STORAGE_DISCOVERY_LIMIT = 100;
export const STORAGE_DISCOVERY_MAX_BYTES = 128 * 1024 * 1024;
export const STORAGE_DISCOVERY_MAX_OFFSET = 10000;
export type StorageObjectIdentity = {
  key: string;
  sizeBytes: number;
  sha256Hash: string;
  modifiedAt: string;
  device: string;
  inode: string;
  mtimeNs: string;
  ctimeNs: string;
};
export type StorageMaintenanceState =
  | "observed"
  | "retired"
  | "deleted"
  | "missing"
  | "changed"
  | "failed";
export type StorageRemovalResult = "deleted" | "missing" | "changed";
export function isMaintenanceAssetKey(key: string): boolean {
  return /^assets\/[A-Za-z0-9_-]{1,128}\/ast_[A-Za-z0-9_-]{1,100}\.(?:zip|rar|7z|lua|luac|dff|txd|col|png|jpg|jpeg|webp|json|map)$/u.test(
    key,
  );
}
