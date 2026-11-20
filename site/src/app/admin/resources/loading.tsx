import { getResourceReleaseControlCopy } from "../../../features/library/resource-release-control-i18n";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-resources-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-28 rounded bg-inset" />,
    load: (locale) => {
      const copy = getResourceReleaseControlCopy(locale);
      return {
        title: copy.moderation,
        loading: copy.moderationLoading,
      };
    },
  });
}
