import { userRepository } from "@nexus/db";
import { after } from "next/server";
import { dispatchNotificationsBestEffort } from "./notification-dispatch-service";

type ReportNotice = {
  id: string;
  status?: string;
  reporterId?: string;
};
function queueNotices(reports: ReportNotice[]) {
  after(async () => {
    try {
      const moderators = reports.some((report) => !report.reporterId)
        ? await userRepository.listModeratorIds()
        : [];
      const inputs = reports.flatMap((report) =>
        report.reporterId
          ? [
              {
                recipientId: report.reporterId,
                title: "Community report status",
                message: `Report status: ${report.status}.`,
                link: `/workspace/reports/${encodeURIComponent(report.id)}`,
                type: "security" as const,
              },
            ]
          : moderators.map((recipientId) => ({
              recipientId,
              title: "New community report",
              message: "A community report is awaiting review.",
              link: `/admin/reports/${encodeURIComponent(report.id)}`,
              type: "security" as const,
            })),
      );
      const result = await dispatchNotificationsBestEffort(inputs);
      if (result.storageFailed)
        console.warn(
          JSON.stringify({
            event: "community_report.notification_failed",
            count: result.storageFailed,
          }),
        );
    } catch {
      console.warn(JSON.stringify({ event: "community_report.notification_failed" }));
    }
  });
}

export function queueCommunityReportNotice(report: ReportNotice) {
  queueNotices([report]);
}
export function queueCommunityReportBatchNotices(
  reports: { id: string; status: string; reporterId: string }[],
) {
  if (!reports.length || reports.length > 20) throw new RangeError("Invalid report notices");
  queueNotices(reports);
}
