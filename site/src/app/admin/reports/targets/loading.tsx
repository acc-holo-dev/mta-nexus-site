import { reportGroupsCopy } from "../../../../features/community/community-report-groups-copy";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "report-groups-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    leading: <div className="h-32 rounded bg-inset" />,
    load: (locale) => {
      const copy = reportGroupsCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
