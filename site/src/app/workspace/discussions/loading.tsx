import { DiscussionWorkspaceRouteLoading } from "../../../features/community/discussion-workspace-route-loading-server";
import { pageShellMax4xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return DiscussionWorkspaceRouteLoading({
    headingId: "discussions-loading-heading",
    className: pageShellMax4xl,
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-28 rounded bg-inset" />,
    titleKey: "title",
  });
}
