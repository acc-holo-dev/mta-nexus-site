// Organization access audits name the affected account in a fixed detail key.
// Security Center may project that account; other JSON stays private.
export const SECURITY_SUBJECT_DETAIL_KEYS = {
  "organization.ownership_transferred": "newOwnerId",
  "organization.member_added": "userId",
  "organization.member_updated": "userId",
  "organization.member_removed": "userId",
} as const;

export type SecuritySubjectAction = keyof typeof SECURITY_SUBJECT_DETAIL_KEYS;

export const SECURITY_SUBJECT_ACTIONS = Object.keys(
  SECURITY_SUBJECT_DETAIL_KEYS,
) as SecuritySubjectAction[];
