import { FollowWorkspaceRouteLoading } from "../../../features/community/follow-workspace-route-loading-server";

export default async function Loading() {
  return FollowWorkspaceRouteLoading({
    headingId: "saved-follows-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rowClassName: "h-24 rounded bg-inset",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "title",
  });
}
