import { SubscriptionsRouteLoading } from "../../../../features/commerce/subscriptions-route-loading-server";

export default async function Loading() {
  return SubscriptionsRouteLoading({
    headingId: "subscriptions-history-loading-heading",
    rows: 4,
    titleKey: "history",
  });
}
