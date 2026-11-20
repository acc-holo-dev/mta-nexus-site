import { getCommercialCopy } from "../../../../../features/commerce/commercial-i18n";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-plan-new-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    load: (locale) => {
      const copy = getCommercialCopy(locale);
      return {
        title: copy.newPlan,
        loading: copy.loading,
      };
    },
  });
}
