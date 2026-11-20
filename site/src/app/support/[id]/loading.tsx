import { SupportWorkspaceRouteLoading } from "../../../features/support/support-workspace-route-loading-server";
import { pageShellStack6 } from "../../../features/shell/page-shell";

export default async function Loading() {
  return SupportWorkspaceRouteLoading({
    headingId: "support-case-loading-heading",
    className: pageShellStack6,
    rows: 0,
    leading: (
      <>
        <div className="h-24 rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </>
    ),
  });
}
