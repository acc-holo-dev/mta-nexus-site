export const REPORT_HISTORY_GROUPS = ["all", "submission", "review", "decision"] as const;
export type ReportHistoryGroup = (typeof REPORT_HISTORY_GROUPS)[number];
export const REPORT_HISTORY_ACTIONS = [
  "report.created",
  "report.review",
  "report.resolve",
  "report.dismiss",
  "report.remove_comment",
] as const;
