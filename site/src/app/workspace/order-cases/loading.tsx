import { orderCaseCopy } from "../../../features/commerce/order-case-i18n";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
    headingId: "order-cases-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    load: (locale) => {
      const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
      const copy = orderCaseCopy(typedLocale);
      return {
        title: copy.buyerCases,
        loading: copy.loading,
      };
    },
  });
}
