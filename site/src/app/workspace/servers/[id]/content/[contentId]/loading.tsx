import { ServerContentRouteLoading } from "../../../../../../features/servers/server-content-route-loading-server";

export default async function Loading() {
  return ServerContentRouteLoading({
    headingId: "server-content-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "title",
  });
}
