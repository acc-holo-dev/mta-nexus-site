import { ServerContentRouteLoading } from "../../../../../../features/servers/server-content-route-loading-server";
import { pageShellMax3xl } from "../../../../../../features/shell/page-shell";

export default async function Loading() {
  return ServerContentRouteLoading({
    headingId: "server-content-detail-loading-heading",
    className: pageShellMax3xl,
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "title",
  });
}
