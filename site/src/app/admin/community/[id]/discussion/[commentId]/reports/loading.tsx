import { CommunityModerationRouteLoading } from "../../../../../../../features/community/community-moderation-route-loading-server";
import { discussionReportsCopy } from "../../../../../../../features/community/discussion-reports-copy";

export default async function Loading() {
  return CommunityModerationRouteLoading({
    headingId: "admin-discussion-reports-loading-heading",
    titleClassName: "text-2xl font-extrabold text-primary",
    title: (locale) => discussionReportsCopy(locale).title,
  });
}
