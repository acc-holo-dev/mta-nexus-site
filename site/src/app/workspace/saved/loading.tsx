import { FollowWorkspaceRouteLoading } from "../../../features/community/follow-workspace-route-loading-server";
import { pageShellMax5xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return FollowWorkspaceRouteLoading({
    headingId: "saved-follows-loading-heading",
    className: pageShellMax5xl,
    rowClassName: "h-24 rounded bg-inset",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "title",
  });
}
