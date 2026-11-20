import { ResourceCartReceiptsRouteLoading } from "../../../../../features/resources/resource-cart-receipts-route-loading-server";

export default async function Loading() {
  return ResourceCartReceiptsRouteLoading({
    headingId: "acquisition-receipt-detail-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    leading: <div className="h-10 w-72 rounded bg-inset" />,
    titleKey: "title",
  });
}
