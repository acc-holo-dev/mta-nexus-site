export const LICENSE_EXPIRING_DAYS = 3;
export const LICENSE_MAINTENANCE_BATCH_LIMIT = 100;
export type LicenseTermEvent = "expiring" | "expired";
export type LicenseArchiveFilter = {
  status: "all" | "active" | "expiring" | "expired" | "suspended" | "revoked";
  binding: "all" | "bound" | "unbound";
  term: "all" | "finite" | "unknown";
  sort: "newest" | "expires_soon";
  q: string;
};
export type LicenseTermNotificationData = {
  kind: "license_term";
  event: LicenseTermEvent;
  expiresAt: string;
};
export type LicenseMaintenanceResult = {
  processed: number;
  expired: number;
  warned: number;
  inbox: number;
  pushJobs: number;
};
