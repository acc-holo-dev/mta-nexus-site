/** Audit journals expose recorded field names, never prior values or private audit data. */
export const CHANGE_HISTORY_PERIODS = ["all", "7", "30", "90", "365"] as const;
export type ChangeHistoryPeriod = (typeof CHANGE_HISTORY_PERIODS)[number];
export type ChangeHistoryCursor = { version: 1; context: string; until: string; id: string };
export type ChangeHistoryFilters<Group extends string> = {
  period: ChangeHistoryPeriod;
  group: Group;
  query: string;
  cursor?: ChangeHistoryCursor;
  before?: string;
  until?: string;
};
export const PROFILE_CHANGE_GROUPS = ["all", "profile", "professional", "privacy"] as const;
export type ProfileChangeGroup = (typeof PROFILE_CHANGE_GROUPS)[number];
export const PROFILE_CHANGE_ACTIONS = [
  "user.profile_updated",
  "developer.profile_updated",
  "user.privacy_updated",
] as const;
export const PROFILE_CHANGE_FIELDS = [
  "displayName",
  "bio",
  "avatarUrl",
  "specialties",
  "githubUrl",
  "discordTag",
  "showActivity",
  "showProfessionalContacts",
] as const;
export const ORGANIZATION_CHANGE_GROUPS = ["all", "profile", "team", "ownership"] as const;
export type OrganizationChangeGroup = (typeof ORGANIZATION_CHANGE_GROUPS)[number];
export const ORGANIZATION_CHANGE_ACTIONS = [
  "organization.created",
  "organization.profile_updated",
  "organization.member_added",
  "organization.member_updated",
  "organization.member_removed",
  "organization.member_left",
  "organization.ownership_transferred",
] as const;
