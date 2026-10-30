import { SECURITY_SUBJECT_ACTIONS, type SecuritySubjectAction } from "@nexus/domain";

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

export const SECURITY_SUBJECT_LABEL_KEYS = {
  "organization.ownership_transferred": "organizationOwnershipReceived",
  "organization.member_added": "organizationMembershipGranted",
  "organization.member_updated": "organizationMembershipChanged",
  "organization.member_removed": "organizationMembershipEnded",
} as const satisfies Record<SecuritySubjectAction, string>;

const SECURITY_ACTIVITY_SET = new Set<string>(SECURITY_ACTIVITY_ACTIONS);

export function isSecurityActivityAction(action: string): action is SecurityActivityAction {
  return SECURITY_ACTIVITY_SET.has(action);
}

export interface SecurityActivityItem {
  id: string;
  action: SecurityActivityAction;
  targetType: string;
  perspective: "actor" | "subject";
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export function securityActivityLabelKey(item: SecurityActivityItem) {
  if (item.perspective === "subject" && item.action in SECURITY_SUBJECT_LABEL_KEYS) {
    return SECURITY_SUBJECT_LABEL_KEYS[item.action as SecuritySubjectAction];
  }
  return SECURITY_ACTIVITY_LABEL_KEYS[item.action];
}

export function toSecurityActivityItem(
  event: {
    id: string;
    action: string;
    actorId?: string;
    targetType: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
    /** Accepted so full audit rows can be mapped; never copied into the user-facing item. */
    details?: unknown;
  },
  viewerId?: string,
): SecurityActivityItem | null {
  if (!isSecurityActivityAction(event.action)) return null;
  const subject =
    viewerId !== undefined && event.actorId !== undefined && event.actorId !== viewerId;
  if (subject && !(SECURITY_SUBJECT_ACTIONS as readonly string[]).includes(event.action))
    return null;
  return {
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    perspective: subject ? "subject" : "actor",
    ...(subject
      ? {}
      : {
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
        }),
    createdAt: event.createdAt,
  };
}
