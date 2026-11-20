import { PublicVerificationHistoryRouteLoading } from "../../../../../features/trust/public-verification-history-route-loading-server";

export default async function Loading() {
  return PublicVerificationHistoryRouteLoading({
    headingId: "user-trust-history-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip",
    titleKey: "title",
  });
}
