import { VerificationWorkspaceRouteLoading } from "../../../features/trust/verification-workspace-route-loading-server";

export default async function Loading() {
  return VerificationWorkspaceRouteLoading({
    headingId: "verification-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8",
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "title",
  });
}
