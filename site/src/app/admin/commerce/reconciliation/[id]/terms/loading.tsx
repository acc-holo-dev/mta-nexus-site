import { orderTermsCopy } from "../../../../../../features/commerce/order-terms-i18n";
import { LocaleCopyRouteLoading } from "../../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "admin-reconciliation-terms-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-72 max-w-full rounded bg-inset" />,
    load: (locale) => {
      const copy = orderTermsCopy(locale);
      return {
        title: copy.title,
        loading: copy.termsLoading,
      };
    },
  });
}
