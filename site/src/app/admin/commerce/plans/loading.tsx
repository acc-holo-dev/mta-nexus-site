import { CommercialRouteLoading } from "../../../../features/commerce/commercial-route-loading-server";

export default async function Loading() {
  return CommercialRouteLoading({
    headingId: "admin-plans-loading-heading",
    titleKey: "admin",
  });
}
