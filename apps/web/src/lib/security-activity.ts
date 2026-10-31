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
  "commerce.subscription_expired",
  "commerce.subscription_activated_free",
  "commerce.subscription_cancelled",
  "commerce.order_case.created",
  "commerce.order_case.reviewed",
  "commerce.plan_review_saved",
  "support.case.created",
  "support.case.status_changed",
  "support.message.created",
  "resource.cart_acquired",
  "verification.application_updated",
  "user.privacy_updated",
  "license.bound",
  "license.binding_refreshed",
  "license.token_rotated",
  "license.token_revoked",
  "license.revoked",
  "license.suspended",
  "license.restored",
  "license.expired",
  "license.expiring",
  "organization.ownership_transferred",
  "organization.member_added",
  "organization.member_updated",
  "organization.member_removed",
  "organization.member_left",
  "server.claim_challenge_issued",
  "server.control_proof_recorded",
  "server.verification_approved",
  "server.verification_rejected",
  "verification.requested",
  "verification.approved",
  "verification.rejected",
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
  "commerce.subscription_expired": "subscriptionExpired",
  "commerce.subscription_activated_free": "subscriptionActivatedFree",
  "commerce.subscription_cancelled": "subscriptionCancelled",
  "commerce.order_case.created": "orderCaseCreated",
  "commerce.order_case.reviewed": "orderCaseReviewed",
  "commerce.plan_review_saved": "planReviewSaved",
  "support.case.created": "supportCaseCreated",
  "support.case.status_changed": "supportCaseStatusChanged",
  "support.message.created": "supportMessageCreated",
  "resource.cart_acquired": "resourceCartAcquired",
  "verification.application_updated": "verificationApplicationUpdated",
  "user.privacy_updated": "privacyUpdated",
  "license.bound": "licenseBound",
  "license.binding_refreshed": "licenseBindingRefreshed",
  "license.token_rotated": "licenseTokenRotated",
  "license.token_revoked": "licenseTokenRevoked",
  "license.revoked": "licenseRevoked",
  "license.suspended": "licenseSuspended",
  "license.restored": "licenseRestored",
  "license.expired": "licenseExpired",
  "license.expiring": "licenseExpiring",
  "organization.ownership_transferred": "organizationOwnershipTransferred",
  "organization.member_added": "organizationMemberAdded",
  "organization.member_updated": "organizationMemberUpdated",
  "organization.member_removed": "organizationMemberRemoved",
  "organization.member_left": "organizationMemberLeft",
  "server.claim_challenge_issued": "serverClaimChallengeIssued",
  "server.control_proof_recorded": "serverControlProofRecorded",
  "server.verification_approved": "serverVerificationApproved",
  "server.verification_rejected": "serverVerificationRejected",
  "verification.requested": "verificationRequested",
  "verification.approved": "verificationApproved",
  "verification.rejected": "verificationRejected",
  "product.download_started": "productDownloadStarted",
  "product.download_finished": "productDownloadFinished",
} as const satisfies Record<SecurityActivityAction, string>;

export const SECURITY_SUBJECT_LABEL_KEYS = {
  "organization.ownership_transferred": "organizationOwnershipReceived",
  "organization.member_added": "organizationMembershipGranted",
  "organization.member_updated": "organizationMembershipChanged",
  "organization.member_removed": "organizationMembershipEnded",
  "license.revoked": "licenseRevokedByStaff",
  "license.suspended": "licenseSuspendedByStaff",
  "license.restored": "licenseRestoredByStaff",
  "license.expired": "licenseExpiredNotice",
  "license.expiring": "licenseExpiringNotice",
  "commerce.order_case.reviewed": "orderCaseReviewedNotice",
  "support.case.status_changed": "supportCaseStatusChangedNotice",
  "support.message.created": "supportMessageCreatedNotice",
  "verification.approved": "verificationApprovedNotice",
  "verification.rejected": "verificationRejectedNotice",
  "server.verification_approved": "serverVerificationApprovedNotice",
  "server.verification_rejected": "serverVerificationRejectedNotice",
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
