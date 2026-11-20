import { communityReportCopy } from "../../../features/community/community-report-copy";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "workspace-reports-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    leading: <div className="h-28 rounded bg-inset" />,
    load: (locale) => {
      const copy = communityReportCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
