import { DiscoveryStreamRouteLoading } from "../../../features/discovery/discovery-stream-route-loading-server";

export default async function Loading() {
  return DiscoveryStreamRouteLoading({
    headingId: "discover-stream-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    leading: <div className="h-24 rounded bg-inset" />,
    titleKey: "title",
  });
}
