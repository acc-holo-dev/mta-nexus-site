import { ProfilePrivacyRouteLoading } from "../../../features/accounts/profile-privacy-route-loading-server";

export default async function Loading() {
  return ProfilePrivacyRouteLoading({
    headingId: "privacy-loading-heading",
    className: "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8",
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
