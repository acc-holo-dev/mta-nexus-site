import { SettingsRouteLoading } from "../../features/accounts/settings-route-loading-server";

export default async function SettingsLoading() {
  return SettingsRouteLoading({
    headerClassName: "",
    statusClassName: "mt-1 font-caption text-muted",
  });
}
