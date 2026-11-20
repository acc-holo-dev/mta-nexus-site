import { CommercialRouteLoading } from "../../features/commerce/commercial-route-loading-server";
import { subscriptionsCopy } from "../../features/commerce/subscriptions-i18n";

export default async function Loading() {
  return CommercialRouteLoading({
    headingId: "subscriptions-catalog-loading-heading",
    rowClassName: "h-28 rounded bg-inset",
    titleKey: "catalog",
    loading: (locale) => subscriptionsCopy(locale).loading,
  });
}
