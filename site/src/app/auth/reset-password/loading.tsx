import { AuthRouteLoading } from "../../../features/accounts/auth-route-loading-server";

export default async function Loading() {
  return AuthRouteLoading({
    headingId: "auth-reset-loading-heading",
    titlePath: "recovery.resetTitle",
    loadingPath: "recovery.checkingReset",
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
      </>
    ),
  });
}
