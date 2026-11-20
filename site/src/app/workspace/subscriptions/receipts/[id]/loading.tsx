import { SubscriptionsRouteLoading } from "../../../../../features/commerce/subscriptions-route-loading-server";

export default async function Loading() {
  return SubscriptionsRouteLoading({
    headingId: "subscription-receipt-loading-heading",
    titleKey: "recorded",
  });
}
