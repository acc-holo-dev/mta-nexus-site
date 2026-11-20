import { PrivateChangeHistoryRouteLoading } from "../../../features/accounts/private-change-history-route-loading-server";

export default async function Loading() {
  return PrivateChangeHistoryRouteLoading({
    headingId: "settings-history-loading-heading",
    className: "mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip py-8",
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "profileTitle",
  });
}
