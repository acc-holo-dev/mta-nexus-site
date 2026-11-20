import { ContentReactionRouteLoading } from "../../../features/community/content-reaction-route-loading-server";

export default async function Loading() {
  return ContentReactionRouteLoading({
    headingId: "reactions-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-24 rounded bg-inset" />,
    titleKey: "my",
  });
}
