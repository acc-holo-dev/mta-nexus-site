import { PublicationFeedLoading } from "../../../features/community/publication-feed-loading-server";

const pageShellClass = "min-w-0 overflow-x-clip";

export default async function Loading() {
  return <div className={pageShellClass}>{await PublicationFeedLoading({ heading: "title" })}</div>;
}
