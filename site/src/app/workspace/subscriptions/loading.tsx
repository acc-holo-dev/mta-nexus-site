import { SubscriptionsRouteLoading } from "../../../features/commerce/subscriptions-route-loading-server";

export default async function Loading() {
  return SubscriptionsRouteLoading({
    headingId: "subscriptions-loading-heading",
    leading: (
      <>
        <div className="h-10 w-64 rounded bg-inset" />
        <div className="h-28 rounded bg-inset" />
      </>
    ),
    titleKey: "title",
  });
}
