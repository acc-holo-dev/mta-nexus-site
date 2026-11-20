import { ServerPublicationHistoryRouteLoading } from "../../../../../../../features/servers/server-publication-history-route-loading-server";
import { pageShellMax4xlDense } from "../../../../../../../features/shell/page-shell";

export default async function Loading() {
  return ServerPublicationHistoryRouteLoading({
    headingId: "content-history-loading-heading",
    className: pageShellMax4xlDense,
    headerClassName: "",
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "title",
  });
}
