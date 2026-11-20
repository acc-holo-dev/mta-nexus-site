import { CommerceHistoryRouteLoading } from "../../../../features/commerce/commerce-history-route-loading-server";
import { orderCaseCopy } from "../../../../features/commerce/order-case-i18n";

export default async function Loading() {
  return CommerceHistoryRouteLoading({
    headingId: "admin-order-cases-loading-heading",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    title: (locale) => orderCaseCopy(locale).queue,
  });
}
