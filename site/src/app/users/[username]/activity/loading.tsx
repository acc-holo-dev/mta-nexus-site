import { PublicationFeedLoading } from "../../../../components/publication-feed-loading";

const pageShellClass = "min-w-0 overflow-x-clip";

export default async function Loading() {
  return (
    <div className={pageShellClass}>{await PublicationFeedLoading({ heading: "activity" })}</div>
  );
}
