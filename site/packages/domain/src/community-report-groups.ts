import type { ChangeHistoryFilters } from "./private-change-history";
export type CommunityReportGroupFilters = ChangeHistoryFilters<"all"> & {
  view: "pending" | "history";
  target?: "content" | "comment";
  type?: string;
};
