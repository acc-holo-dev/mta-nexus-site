import { DiscussionWorkspaceRouteLoading } from "../../../features/community/discussion-workspace-route-loading-server";

export default async function Loading() {
  return DiscussionWorkspaceRouteLoading({
    headingId: "discussions-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
