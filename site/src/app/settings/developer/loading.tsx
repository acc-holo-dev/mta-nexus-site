import { SettingsRouteLoading } from "../../../features/accounts/settings-route-loading-server";
import { pageShellMax3xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return SettingsRouteLoading({
    headingId: "developer-settings-loading-heading",
    className: pageShellMax3xl,
    rowClassName: "h-24 rounded bg-inset",
    leading: <div className="h-28 rounded bg-inset" />,
  });
}
