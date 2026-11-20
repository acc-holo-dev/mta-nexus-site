import { getCommercialCopy } from "../../features/commerce/commercial-i18n";
import { subscriptionsCopy } from "../../features/commerce/subscriptions-i18n";
import { LocaleCopyRouteLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "subscriptions-catalog-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    rowClassName: "h-28 rounded bg-inset",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    load: (locale) => {
      const copy = getCommercialCopy(locale);
      const status = subscriptionsCopy(locale);
      return {
        title: copy.catalog,
        loading: status.loading,
      };
    },
  });
}
