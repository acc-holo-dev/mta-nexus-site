import { reportGroupsCopy } from "../../../../../features/community/community-report-groups-copy";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-publication-reports-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    titleClassName: "text-2xl font-extrabold text-primary",
    leading: <div className="h-24 rounded bg-inset" />,
    load: (locale) => {
      const copy = reportGroupsCopy(locale);
      return {
        title: copy.publicationTitle,
        loading: copy.publicationLoading,
      };
    },
  });
}
