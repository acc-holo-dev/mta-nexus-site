// Organization access audits name the affected account in a fixed detail key.
// Security Center may project that account; other JSON stays private.
export const SECURITY_SUBJECT_DETAIL_KEYS = {
  "organization.ownership_transferred": "newOwnerId",
  "organization.member_added": "userId",
  "organization.member_updated": "userId",
  "organization.member_removed": "userId",
} as const;

export type SecuritySubjectDetailAction = keyof typeof SECURITY_SUBJECT_DETAIL_KEYS;

// License moderation/maintenance targets a license row; the account is the owner.
export const SECURITY_LICENSE_SUBJECT_ACTIONS = [
  "license.revoked",
  "license.suspended",
  "license.restored",
  "license.expired",
  "license.expiring",
] as const;

export type SecurityLicenseSubjectAction = (typeof SECURITY_LICENSE_SUBJECT_ACTIONS)[number];

// Staff review of an order case targets the support case; the account is the requester.
export const SECURITY_COMMERCE_SUBJECT_ACTIONS = ["commerce.order_case.reviewed"] as const;

export type SecurityCommerceSubjectAction = (typeof SECURITY_COMMERCE_SUBJECT_ACTIONS)[number];

// Staff verification decisions target a verification request; the account is the requester.
export const SECURITY_VERIFICATION_SUBJECT_ACTIONS = [
  "verification.approved",
  "verification.rejected",
] as const;

export type SecurityVerificationSubjectAction =
  (typeof SECURITY_VERIFICATION_SUBJECT_ACTIONS)[number];

export type SecuritySubjectAction =
  | SecuritySubjectDetailAction
  | SecurityLicenseSubjectAction
  | SecurityCommerceSubjectAction
  | SecurityVerificationSubjectAction;

export const SECURITY_SUBJECT_ACTIONS = [
  ...(Object.keys(SECURITY_SUBJECT_DETAIL_KEYS) as SecuritySubjectDetailAction[]),
  ...SECURITY_LICENSE_SUBJECT_ACTIONS,
  ...SECURITY_COMMERCE_SUBJECT_ACTIONS,
  ...SECURITY_VERIFICATION_SUBJECT_ACTIONS,
] as const satisfies readonly SecuritySubjectAction[];
