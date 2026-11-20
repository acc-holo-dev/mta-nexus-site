import { PublicContextTrustRouteLoading } from "../../../../features/trust/public-context-trust-route-loading-server";

export default async function Loading() {
  return PublicContextTrustRouteLoading({
    headingId: "context-trust-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    rowClassName: "h-24 max-w-full rounded bg-inset",
    titleKey: "title",
  });
}
