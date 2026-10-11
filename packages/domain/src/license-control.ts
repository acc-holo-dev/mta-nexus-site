export const LICENSE_RUNTIME_TOKEN_DAYS = 30;
export const LICENSE_RUNTIME_TOKEN_PATTERN = /^nxlt_[A-Za-z0-9_-]{43}$/u;

export type LicenseOwnerAction =
  | "bind"
  | "refresh_binding"
  | "rotate_token"
  | "revoke_token"
  | "revoke";
export type LicenseModerationAction = "suspend" | "restore" | "revoke";
export type LicenseOwnerCommand = { expectedUpdatedAt: string; reason: string } & (
  | { action: "bind"; serverId: string }
  | { action: "refresh_binding"; expectedEndpointRevision: number }
  | { action: Exclude<LicenseOwnerAction, "bind" | "refresh_binding"> }
);
export type LicenseModerationCommand = {
  action: LicenseModerationAction;
  expectedUpdatedAt: string;
  reason: string;
};

export function canModerateLicense(status: string, action: LicenseModerationAction): boolean {
  if (action === "suspend") return status === "active";
  if (action === "restore") return status === "suspended";
  return status === "active" || status === "suspended" || status === "expired";
}

export interface LicenseControlConfirmation {
  license: { id: string; status: string; updatedAt: string; serverBound: boolean };
  token?: { value: string; expiresAt: string };
  binding?: { endpointRevision: number; tokenRevoked: true };
}

export const LICENSE_RUNTIME_LEASE_SECONDS = 60;
export interface LicenseReleaseCheck {
  serverId: string;
  productId: string;
  buildId: string;
  sha256Hash: string;
  nonce: string;
}
export interface LicenseReleaseConfirmation extends LicenseReleaseCheck {
  valid: true;
  licenseId: string;
  version: string;
  checkedAt: string;
  expiresAt: string;
  leaseExpiresAt: string;
  recheckAfterSeconds: number;
}
