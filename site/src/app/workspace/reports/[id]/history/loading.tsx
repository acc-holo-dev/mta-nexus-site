import { reportHistoryCopy } from "../../../../../features/community/community-report-history-copy";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "report-history-loading-heading",
    className: "nexus-panel min-w-0 space-y-4 overflow-x-clip p-6",
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    load: (locale) => {
      const copy = reportHistoryCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
