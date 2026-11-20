import { VerificationApplicationsRouteLoading } from "../../../../features/moderation/verification-applications-route-loading-server";
import { pageShellMax3xl } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return VerificationApplicationsRouteLoading({
    headingId: "verification-detail-loading-heading",
    className: pageShellMax3xl,
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "detail",
  });
}
