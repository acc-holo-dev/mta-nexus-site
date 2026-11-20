import { AuthRouteLoading } from "../../../features/accounts/auth-route-loading-server";

export default async function Loading() {
  return AuthRouteLoading({
    headingId: "auth-forgot-loading-heading",
    titlePath: "recovery.forgotTitle",
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
      </>
    ),
  });
}
