import { CommunityModerationRouteLoading } from "../../../../../features/community/community-moderation-route-loading-server";
import { moderatedDiscussionCopy } from "../../../../../features/community/moderated-discussion-copy";

export default async function Loading() {
  return CommunityModerationRouteLoading({
    headingId: "admin-discussion-loading-heading",
    titleClassName: "text-2xl font-extrabold text-primary",
    title: (locale) => moderatedDiscussionCopy(locale).title,
  });
}
