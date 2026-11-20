import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";
import { contextTrustCopy } from "../../../../features/trust/public-context-trust-copy";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "context-trust-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    rowClassName: "h-24 max-w-full rounded bg-inset",
    load: (locale) => {
      const copy = contextTrustCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
