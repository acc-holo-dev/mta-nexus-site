import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";
import { approvalCopy } from "../../../../../features/trust/public-verification-history-copy";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "user-trust-history-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    load: (locale) => {
      const copy = approvalCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
