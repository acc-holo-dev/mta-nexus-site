import { CommerceHistoryRouteLoading } from "../../../../features/commerce/commerce-history-route-loading-server";

export default async function Loading() {
  return CommerceHistoryRouteLoading({
    headingId: "purchase-detail-loading-heading",
    titleKey: "details",
  });
}
