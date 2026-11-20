import { privateChangeHistoryCopy } from "../../../features/accounts/private-change-history-copy";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "settings-history-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip py-8",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    load: (locale) => {
      const copy = privateChangeHistoryCopy(locale);
      return {
        title: copy.profileTitle,
        loading: copy.loading,
      };
    },
  });
}
