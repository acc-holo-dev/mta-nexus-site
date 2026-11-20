import { ownDiscussionCopy } from "../../../features/community/discussion-workspace-copy";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "discussions-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-28 rounded bg-inset" />,
    load: (locale) => {
      const copy = ownDiscussionCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
