import { VerificationApplicationsRouteLoading } from "../../../../features/moderation/verification-applications-route-loading-server";
import { pageShellMax4xl } from "../../../../features/shell/page-shell";

export default async function Loading() {
  return VerificationApplicationsRouteLoading({
    headingId: "verification-history-loading-heading",
    className: pageShellMax4xl,
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "title",
  });
}
