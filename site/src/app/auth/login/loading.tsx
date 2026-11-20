import { AuthRouteLoading } from "../../../features/accounts/auth-route-loading-server";

export default async function Loading() {
  return AuthRouteLoading({
    headingId: "auth-login-loading-heading",
    titlePath: "auth.loginTitle",
    leading: (
      <>
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
        <div className="h-11 rounded bg-inset" />
      </>
    ),
  });
}
