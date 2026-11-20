import { pageShellMax4xlTight } from "../../../../features/shell/page-shell";
import { PublicContextTrustRouteLoading } from "../../../../features/trust/public-context-trust-route-loading-server";

export default async function Loading() {
  return PublicContextTrustRouteLoading({
    headingId: "context-trust-loading-heading",
    className: pageShellMax4xlTight,
    rowClassName: "h-24 max-w-full rounded bg-inset",
    titleKey: "title",
  });
}
