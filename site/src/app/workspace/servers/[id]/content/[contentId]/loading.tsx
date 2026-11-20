import { serverContentCopy } from "../../../../../../features/servers/server-content-copy";
import { LocaleCopyRouteLoading } from "../../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "server-content-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    load: (locale) => {
      const team = serverContentCopy(locale);
      return {
        title: team.title,
        loading: team.loading,
      };
    },
  });
}
