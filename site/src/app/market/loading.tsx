import { MarketRouteLoading } from "../../features/resources/market-route-loading-server";

export default async function Loading() {
  return MarketRouteLoading({
    headingId: "market-loading-heading",
  });
}
