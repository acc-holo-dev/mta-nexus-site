import { pageShellMax5xl } from "../../../features/shell/page-shell";
import { VerificationWorkspaceRouteLoading } from "../../../features/trust/verification-workspace-route-loading-server";

export default async function Loading() {
  return VerificationWorkspaceRouteLoading({
    headingId: "verification-loading-heading",
    className: pageShellMax5xl,
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "title",
  });
}
