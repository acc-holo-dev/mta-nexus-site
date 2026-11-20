import { ManagedServerRouteLoading } from "../../../features/servers/managed-server-route-loading-server";
import { pageShellMax6xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return ManagedServerRouteLoading({
    headingId: "managed-servers-loading-heading",
    className: pageShellMax6xl,
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
