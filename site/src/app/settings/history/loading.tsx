import { PrivateChangeHistoryRouteLoading } from "../../../features/accounts/private-change-history-route-loading-server";
import { pageShellMax5xlDense } from "../../../features/shell/page-shell";

export default async function Loading() {
  return PrivateChangeHistoryRouteLoading({
    headingId: "settings-history-loading-heading",
    className: pageShellMax5xlDense,
    leading: <div className="h-6 w-2/3 rounded bg-inset" />,
    titleKey: "profileTitle",
  });
}
