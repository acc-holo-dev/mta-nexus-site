import { DiscoveryRouteLoading } from "../../features/discovery/discovery-route-loading-server";
import { pageShellStack6 } from "../../features/shell/page-shell";

export default async function Loading() {
  return DiscoveryRouteLoading({
    headingId: "organizations-loading-heading",
    className: pageShellStack6,
    rowClassName: "h-24 max-w-full rounded bg-inset",
    rows: 4,
    leading: <div className="h-11 max-w-full rounded bg-inset" />,
    titleKey: "organizationsTitle",
    loadingKey: "organizationsLoading",
  });
}
