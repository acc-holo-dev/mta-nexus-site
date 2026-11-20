import { ContentReactionRouteLoading } from "../../../features/community/content-reaction-route-loading-server";
import { pageShellMax4xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return ContentReactionRouteLoading({
    headingId: "reactions-loading-heading",
    className: pageShellMax4xl,
    leading: <div className="h-24 rounded bg-inset" />,
    titleKey: "my",
  });
}
