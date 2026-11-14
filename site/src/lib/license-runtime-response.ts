import {
  LICENSE_RUNTIME_LEASE_SECONDS,
  type LicenseReleaseCheck,
  type LicenseReleaseConfirmation,
} from "@nexus/domain";
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(value);
const hash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const timestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
export type LicenseRuntimeContext = {
  licenseId: string;
  productId: string;
  serverId: string;
  items: { id: string; version: string; sha256Hash: string }[];
  page: number;
  totalPages: number;
  total: number;
};

export function parseLicenseRuntimeContext(
  value: unknown,
  licenseId: string,
): LicenseRuntimeContext | null {
  if (
    !record(value) ||
    value.licenseId !== licenseId ||
    !identifier(value.productId) ||
    !identifier(value.serverId) ||
    !Array.isArray(value.items) ||
    value.items.length > 20 ||
    !Number.isSafeInteger(value.page) ||
    (value.page as number) < 1 ||
    !Number.isSafeInteger(value.totalPages) ||
    (value.totalPages as number) < (value.page as number) ||
    !Number.isSafeInteger(value.total) ||
    (value.total as number) < value.items.length ||
    value.pageSize !== 20
  )
    return null;
  const items: LicenseRuntimeContext["items"] = [];
  for (const item of value.items) {
    if (
      !record(item) ||
      !identifier(item.id) ||
      !hash(item.sha256Hash) ||
      typeof item.version !== "string" ||
      !item.version.length ||
      item.version.length > 100 ||
      items.some((existing) => existing.id === item.id)
    )
      return null;
    items.push({ id: item.id, version: item.version, sha256Hash: item.sha256Hash });
  }
  return {
    licenseId,
    productId: value.productId,
    serverId: value.serverId,
    items,
    page: value.page as number,
    totalPages: value.totalPages as number,
    total: value.total as number,
  };
}

export function confirmLicenseRelease(
  value: unknown,
  command: LicenseReleaseCheck,
  licenseId: string,
  version: string,
  now = Date.now(),
): value is LicenseReleaseConfirmation {
  if (
    !record(value) ||
    value.valid !== true ||
    value.licenseId !== licenseId ||
    value.version !== version ||
    value.serverId !== command.serverId ||
    value.productId !== command.productId ||
    value.buildId !== command.buildId ||
    value.sha256Hash !== command.sha256Hash ||
    value.nonce !== command.nonce ||
    !timestamp(value.checkedAt) ||
    !timestamp(value.expiresAt) ||
    !timestamp(value.leaseExpiresAt) ||
    !Number.isSafeInteger(value.recheckAfterSeconds) ||
    (value.recheckAfterSeconds as number) < 1 ||
    (value.recheckAfterSeconds as number) > 30
  )
    return false;
  const checked = Date.parse(value.checkedAt),
    expiry = Date.parse(value.expiresAt),
    lease = Date.parse(value.leaseExpiresAt);
  return (
    checked <= now + 15000 &&
    checked >= now - LICENSE_RUNTIME_LEASE_SECONDS * 1000 &&
    lease > Math.max(checked, now) &&
    lease <= expiry &&
    lease <= checked + LICENSE_RUNTIME_LEASE_SECONDS * 1000
  );
}
