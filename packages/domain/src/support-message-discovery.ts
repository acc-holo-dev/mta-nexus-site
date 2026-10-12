import type { ChangeHistoryCursor } from "./private-change-history";

export const SUPPORT_MESSAGE_GROUPS = ["all", "requester", "staff"] as const;
export type SupportMessageGroup = (typeof SUPPORT_MESSAGE_GROUPS)[number];
export type SupportMessageCursor = ChangeHistoryCursor & { direction: "older" | "newer" };
export type SupportMessageFilters = {
  group: SupportMessageGroup;
  query: string;
  cursor?: SupportMessageCursor;
  until?: string;
  focus?: string;
};
