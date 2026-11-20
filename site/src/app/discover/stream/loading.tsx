import { DiscoveryStreamRouteLoading } from "../../../features/discovery/discovery-stream-route-loading-server";
import { pageShellMax4xlTight } from "../../../features/shell/page-shell";

export default async function Loading() {
  return DiscoveryStreamRouteLoading({
    headingId: "discover-stream-loading-heading",
    className: pageShellMax4xlTight,
    leading: <div className="h-24 rounded bg-inset" />,
    titleKey: "title",
  });
}
