import { DiscoveryRouteLoading } from "../../features/discovery/discovery-route-loading-server";

export default async function Loading() {
  return DiscoveryRouteLoading({
    headingId: "organizations-loading-heading",
    className: "min-w-0 space-y-6 overflow-x-clip",
    rowClassName: "h-24 max-w-full rounded bg-inset",
    rows: 4,
    leading: <div className="h-11 max-w-full rounded bg-inset" />,
    titleKey: "organizationsTitle",
    loadingKey: "organizationsLoading",
  });
}
