import { ManagedServerRouteLoading } from "../../../features/servers/managed-server-route-loading-server";

export default async function Loading() {
  return ManagedServerRouteLoading({
    headingId: "managed-servers-loading-heading",
    className: "mx-auto min-w-0 max-w-6xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
