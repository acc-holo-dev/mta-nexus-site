import { CommunityModerationRouteLoading } from "../../../../features/community/community-moderation-route-loading-server";

export default async function Loading() {
  return CommunityModerationRouteLoading({
    headingId: "admin-community-item-loading-heading",
    titleKey: "title",
  });
}
