import { moderationCopy } from "../../../../../../../features/community/community-moderation-copy";
import { discussionReportsCopy } from "../../../../../../../features/community/discussion-reports-copy";
import { LocaleCopyRouteLoading } from "../../../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-discussion-reports-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    titleClassName: "text-2xl font-extrabold text-primary",
    leading: <div className="h-24 rounded bg-inset" />,
    load: (locale) => {
      const title = discussionReportsCopy(locale).title;
      const loading = moderationCopy(locale).loading;
      return {
        title: title,
        loading: loading,
      };
    },
  });
}
