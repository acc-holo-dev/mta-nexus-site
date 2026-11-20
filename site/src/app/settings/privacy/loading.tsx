import { ProfilePrivacyRouteLoading } from "../../../features/accounts/profile-privacy-route-loading-server";
import { pageShellMax3xl } from "../../../features/shell/page-shell";

export default async function Loading() {
  return ProfilePrivacyRouteLoading({
    headingId: "privacy-loading-heading",
    className: pageShellMax3xl,
    rows: 0,
    leading: (
      <>
        <div className="h-28 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
        <div className="h-24 rounded bg-inset" />
      </>
    ),
    titleKey: "title",
  });
}
