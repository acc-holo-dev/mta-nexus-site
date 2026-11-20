import { subscriptionsCopy } from "../../../../../features/commerce/subscriptions-i18n";
import { LocaleCopyRouteLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "subscription-receipt-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    load: (locale) => {
      const copy = subscriptionsCopy(locale);
      return {
        title: copy.recorded,
        loading: copy.loading,
      };
    },
  });
}
