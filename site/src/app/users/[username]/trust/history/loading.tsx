import { pageShellMax4xlTight } from "../../../../../features/shell/page-shell";
import { PublicVerificationHistoryRouteLoading } from "../../../../../features/trust/public-verification-history-route-loading-server";

export default async function Loading() {
  return PublicVerificationHistoryRouteLoading({
    headingId: "user-trust-history-loading-heading",
    className: pageShellMax4xlTight,
    titleKey: "title",
  });
}
