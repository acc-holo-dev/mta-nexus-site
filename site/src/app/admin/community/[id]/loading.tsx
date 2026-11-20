import { moderationCopy } from "../../../../features/community/community-moderation-copy";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-community-item-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    leading: <div className="h-24 rounded bg-inset" />,
    load: (locale) => {
      const copy = moderationCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
