import { MarketRouteLoading } from "../../../features/resources/market-route-loading-server";

export default async function Loading() {
  return MarketRouteLoading({
    headingId: "market-resource-loading-heading",
    rows: 0,
    leading: (
      <>
        <div className="h-48 rounded bg-inset" />
        <div className="h-8 w-64 max-w-full rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-32 rounded bg-inset" />
      </>
    ),
  });
}
