import { PublicationFeedLoading } from "../../../../features/community/publication-feed-loading-server";

export default async function Loading() {
  return await PublicationFeedLoading({ heading: "activity" });
}
