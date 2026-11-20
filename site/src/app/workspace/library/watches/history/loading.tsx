import { resourceReleaseWatchHistoryCopy } from "../../../../../features/resources/resource-release-watch-history-i18n";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "release-watch-history-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-28 rounded bg-inset" />,
    load: (locale) => {
      const copy = resourceReleaseWatchHistoryCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
