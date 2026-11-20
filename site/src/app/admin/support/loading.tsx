import { SupportWorkspaceRouteLoading } from "../../../features/support/support-workspace-route-loading-server";
import { pageShellMax5xlTight } from "../../../features/shell/page-shell";

export default async function Loading() {
  return SupportWorkspaceRouteLoading({
    headingId: "admin-support-loading-heading",
    titlePath: "support.staffQueue",
    className: pageShellMax5xlTight,
    headerClassName: "space-y-2 border-b border-base pb-6",
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
