import { reactionCopy } from "../../../features/community/content-reaction-copy";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "reactions-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-24 rounded bg-inset" />,
    load: (locale) => {
      const copy = reactionCopy(locale);
      return {
        title: copy.my,
        loading: copy.loading,
      };
    },
  });
}
