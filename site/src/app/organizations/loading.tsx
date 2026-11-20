import { discoveryCopy } from "../../features/discovery/discovery-copy";
import { LocaleCopyRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "organizations-loading-heading",
    className: "h-11 max-w-full rounded bg-inset",
    rows: 4,
    rowClassName: "h-24 max-w-full rounded bg-inset",
    leading: <div className="h-11 max-w-full rounded bg-inset" />,
    load: (locale) => {
      const copy = discoveryCopy(locale);
      return {
        title: copy.organizationsTitle,
        loading: copy.organizationsLoading,
      };
    },
  });
}
