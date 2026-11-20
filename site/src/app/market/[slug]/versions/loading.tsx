import { getReleaseHistoryCopy } from "../../../../features/resources/public-release-history";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "market-versions-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    rowClassName: "h-16 rounded bg-inset",
    load: (locale) => {
      const copy = getReleaseHistoryCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
