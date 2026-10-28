import { userRepository } from "@nexus/db";
import { after } from "next/server";
import { dispatchNotificationsBestEffort } from "./notification-dispatch-service";

type ReportNotice = {
  id: string;
};
export function queueCommunityReportNotice(report: ReportNotice) {
  try {
    after(async () => {
      try {
        const moderators = await userRepository.listModeratorIds();
        const inputs = moderators.map((recipientId) => ({
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
  } catch {
    console.warn(JSON.stringify({ event: "community_report.notification_registration_failed" }));
  }
}
