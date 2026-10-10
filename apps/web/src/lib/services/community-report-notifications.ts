import { after } from "next/server";
import { userRepository } from "@nexus/db";
import { dispatchNotificationsBestEffort } from "./notification-dispatch-service";
export function queueCommunityReportNotice(report: {
  id: string;
  status?: string;
  reporterId?: string;
}) {
  after(async () => {
    try {
      const inputs = report.reporterId
        ? [
            {
              recipientId: report.reporterId,
              title: "Community report status",
              message: `Report status: ${report.status}.`,
              link: `/workspace/reports/${encodeURIComponent(report.id)}`,
              type: "security" as const,
            },
          ]
        : (await userRepository.listModeratorIds()).map((recipientId) => ({
            recipientId,
            title: "New community report",
            message: "A community report is awaiting review.",
            link: `/admin/reports/${encodeURIComponent(report.id)}`,
            type: "security" as const,
          }));
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
