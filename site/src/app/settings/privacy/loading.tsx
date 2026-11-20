import { profilePrivacyCopy } from "../../../features/accounts/profile-privacy-copy";
import { LocaleCopyRouteLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  return LocaleCopyRouteLoading({
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
    load: (locale) => {
      const copy = profilePrivacyCopy(locale);
      return {
        title: copy.title,
        loading: copy.loading,
      };
    },
  });
}
