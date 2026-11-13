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

// Staff (or other non-requester) support events target the case; the account is the requester.
export const SECURITY_SUPPORT_SUBJECT_ACTIONS = [
  "support.case.status_changed",
  "support.message.created",
] as const;

export type SecuritySupportSubjectAction = (typeof SECURITY_SUPPORT_SUBJECT_ACTIONS)[number];

// Support-case rows projected to the requester (order-case review + status/message events).
export const SECURITY_SUPPORT_CASE_SUBJECT_ACTIONS = [
  ...SECURITY_COMMERCE_SUBJECT_ACTIONS,
  ...SECURITY_SUPPORT_SUBJECT_ACTIONS,
] as const;

// Staff verification decisions target a verification request; the account is the requester.
export const SECURITY_VERIFICATION_SUBJECT_ACTIONS = [
  "verification.approved",
  "verification.rejected",
] as const;

export type SecurityVerificationSubjectAction =
  (typeof SECURITY_VERIFICATION_SUBJECT_ACTIONS)[number];

// Staff server-claim outcomes target a server row; the account is the claim requester.
// Audit ids are written as aud_server_verification_<verificationRequestId>.
export const SECURITY_SERVER_VERIFICATION_SUBJECT_ACTIONS = [
  "server.verification_approved",
  "server.verification_rejected",
] as const;

export type SecurityServerVerificationSubjectAction =
  (typeof SECURITY_SERVER_VERIFICATION_SUBJECT_ACTIONS)[number];

// Staff community-report outcomes target a report row; the account is the reporter.
export const SECURITY_REPORT_SUBJECT_ACTIONS = [
  "report.review",
  "report.resolve",
  "report.dismiss",
  "report.remove_comment",
] as const;

export type SecurityReportSubjectAction = (typeof SECURITY_REPORT_SUBJECT_ACTIONS)[number];

// SEC-002/SEC-005: staff quarantine with explicit downloader notice targets a build;
// the account is a served downloader of that build. Restore has no notify gate or
// incident fanout, so it is not projected here.
export const SECURITY_BUILD_INCIDENT_SUBJECT_ACTIONS = ["build.quarantined"] as const;

export type SecurityBuildIncidentSubjectAction =
  (typeof SECURITY_BUILD_INCIDENT_SUBJECT_ACTIONS)[number];

export type SecuritySubjectAction =
  | SecuritySubjectDetailAction
  | SecurityLicenseSubjectAction
  | SecurityCommerceSubjectAction
  | SecuritySupportSubjectAction
  | SecurityVerificationSubjectAction
  | SecurityServerVerificationSubjectAction
  | SecurityReportSubjectAction
  | SecurityBuildIncidentSubjectAction;

export const SECURITY_SUBJECT_ACTIONS = [
  ...(Object.keys(SECURITY_SUBJECT_DETAIL_KEYS) as SecuritySubjectDetailAction[]),
  ...SECURITY_LICENSE_SUBJECT_ACTIONS,
  ...SECURITY_COMMERCE_SUBJECT_ACTIONS,
  ...SECURITY_SUPPORT_SUBJECT_ACTIONS,
  ...SECURITY_VERIFICATION_SUBJECT_ACTIONS,
  ...SECURITY_SERVER_VERIFICATION_SUBJECT_ACTIONS,
  ...SECURITY_REPORT_SUBJECT_ACTIONS,
  ...SECURITY_BUILD_INCIDENT_SUBJECT_ACTIONS,
] as const satisfies readonly SecuritySubjectAction[];
