export const SECURITY_ACTIVITY_ACTIONS = [
  "user.registered",
  "user.logged_in",
  "user.logged_out",
  "user.password_changed",
  "user.password_reset",
  "auth.recovery_email_verified",
  "user.context_switched",
  "user.session_revoked",
  "user.other_sessions_revoked",
  // SEC-005 commerce / ownership / delivery (actor-scoped allowlist; existing audit actions)
  "order.terms_recorded",
  "order.unpaid_cancelled",
  "license.bound",
  "license.binding_refreshed",
  "license.token_rotated",
  "license.token_revoked",
  "license.revoked",
  "organization.ownership_transferred",
  "organization.member_added",
  "organization.member_updated",
  "organization.member_removed",
  "organization.member_left",
  "server.claim_challenge_issued",
  "product.download_started",
  "product.download_finished",
] as const;

export type SecurityActivityAction = (typeof SECURITY_ACTIVITY_ACTIONS)[number];

export const SECURITY_ACTIVITY_LABEL_KEYS = {
  "user.registered": "registered",
  "user.logged_in": "loggedIn",
  "user.logged_out": "loggedOut",
  "user.password_changed": "passwordChanged",
  "user.password_reset": "passwordReset",
  "auth.recovery_email_verified": "recoveryVerified",
  "user.context_switched": "contextSwitched",
  "user.session_revoked": "sessionRevoked",
  "user.other_sessions_revoked": "otherSessionsRevoked",
  "order.terms_recorded": "orderTermsRecorded",
  "order.unpaid_cancelled": "orderUnpaidCancelled",
  "license.bound": "licenseBound",
  "license.binding_refreshed": "licenseBindingRefreshed",
  "license.token_rotated": "licenseTokenRotated",
  "license.token_revoked": "licenseTokenRevoked",
  "license.revoked": "licenseRevoked",
  "organization.ownership_transferred": "organizationOwnershipTransferred",
  "organization.member_added": "organizationMemberAdded",
  "organization.member_updated": "organizationMemberUpdated",
  "organization.member_removed": "organizationMemberRemoved",
  "organization.member_left": "organizationMemberLeft",
  "server.claim_challenge_issued": "serverClaimChallengeIssued",
  "product.download_started": "productDownloadStarted",
  "product.download_finished": "productDownloadFinished",
} as const satisfies Record<SecurityActivityAction, string>;

const SECURITY_ACTIVITY_SET = new Set<string>(SECURITY_ACTIVITY_ACTIONS);

export function isSecurityActivityAction(action: string): action is SecurityActivityAction {
  return SECURITY_ACTIVITY_SET.has(action);
}

export interface SecurityActivityItem {
  id: string;
  action: SecurityActivityAction;
  targetType: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export function toSecurityActivityItem(event: {
  id: string;
  action: string;
  targetType: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}): SecurityActivityItem | null {
  if (!isSecurityActivityAction(event.action)) return null;
  return {
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    createdAt: event.createdAt,
  };
}
