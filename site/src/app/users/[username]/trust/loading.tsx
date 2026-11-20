import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";
import { trustCopy } from "../../../../features/trust/public-user-trust-copy";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "user-trust-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    headerClassName: "nexus-panel min-w-0 space-y-3 overflow-x-clip p-6",
    titleClassName: "text-xl font-bold text-primary",
    rowClassName: "h-24 rounded bg-inset",
    load: (locale) => {
      const copy = trustCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
