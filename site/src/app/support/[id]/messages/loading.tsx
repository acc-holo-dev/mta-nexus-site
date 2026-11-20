import { pageShellMax4xlTight } from "../../../../features/shell/page-shell";
import { SupportMessageDiscoveryRouteLoading } from "../../../../features/support/support-message-discovery-route-loading-server";

export default async function Loading() {
  return SupportMessageDiscoveryRouteLoading({
    headingId: "support-messages-loading-heading",
    className: pageShellMax4xlTight,
    headerClassName: "space-y-3 border-b border-base pb-6",
    titleClassName: "text-2xl font-extrabold text-primary",
    leading: <div className="h-10 w-full max-w-md rounded bg-inset" />,
    titleKey: "title",
  });
}
