import { ServerActivityRouteLoading } from "../../../../../features/servers/server-activity-route-loading-server";
import { pageShellMax4xlDense } from "../../../../../features/shell/page-shell";

export default async function Loading() {
  return ServerActivityRouteLoading({
    headingId: "server-activity-loading-heading",
    className: pageShellMax4xlDense,
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "title",
  });
}
