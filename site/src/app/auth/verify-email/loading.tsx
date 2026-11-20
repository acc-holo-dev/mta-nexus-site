import { AuthRouteLoading } from "../../../features/accounts/auth-route-loading-server";

export default async function Loading() {
  return AuthRouteLoading({
    headingId: "auth-verify-email-loading-heading",
    titlePath: "recovery.verifyTitle",
    loadingPath: "recovery.checkingVerification",
    leading: (
      <>
        <div className="h-28 rounded bg-inset" />
        <div className="h-11 w-40 rounded bg-inset" />
      </>
    ),
  });
}
