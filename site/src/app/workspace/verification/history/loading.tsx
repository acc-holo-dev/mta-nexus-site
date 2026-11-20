import { VerificationApplicationsRouteLoading } from "../../../../features/moderation/verification-applications-route-loading-server";

export default async function Loading() {
  return VerificationApplicationsRouteLoading({
    headingId: "verification-history-loading-heading",
    className: "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8",
    titleClassName: "text-xl font-semibold text-primary",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "title",
  });
}
