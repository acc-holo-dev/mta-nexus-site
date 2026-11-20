import { ResourceDeliveriesRouteLoading } from "../../../../features/resources/resource-deliveries-route-loading-server";

export default async function Loading() {
  return ResourceDeliveriesRouteLoading({
    headingId: "library-downloads-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    rows: 4,
    leading: <div className="h-10 w-64 rounded bg-inset" />,
    titleKey: "title",
  });
}
