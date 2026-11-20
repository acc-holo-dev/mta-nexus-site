import { getCommerceHistoryCopy } from "../../../../features/commerce/commerce-history-i18n";
import { orderCaseCopy } from "../../../../features/commerce/order-case-i18n";
import { LocaleCopyRouteLoading } from "../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-order-cases-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    load: (locale) => {
      const copy = orderCaseCopy(locale);
      const history = getCommerceHistoryCopy(locale);
      return {
        title: copy.queue,
        loading: history.loading,
      };
    },
  });
}
