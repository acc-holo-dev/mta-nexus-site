import { profilePrivacyCopy } from "../../../features/accounts/profile-privacy-copy";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = profilePrivacyCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="privacy-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      rows={0}
      leading={
        <>
          <div className="h-28 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
          <div className="h-24 rounded bg-inset" />
        </>
      }
    />
  );
}
