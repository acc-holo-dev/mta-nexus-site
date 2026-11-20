import { getResourceReleaseControlCopy } from "../../../../../features/library/resource-release-control-i18n";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "library-versions-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    load: (locale) => {
      const copy = getResourceReleaseControlCopy(locale);
      return {
        title: copy.versions,
        loading: copy.updatesLoading,
      };
    },
  });
}
