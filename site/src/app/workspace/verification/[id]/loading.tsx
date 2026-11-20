import { verificationApplicationsCopy } from "../../../../features/moderation/verification-applications-copy";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = verificationApplicationsCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="verification-detail-loading-heading"
      title={copy.detail}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      titleClassName="text-xl font-semibold text-primary"
      leading={<div className="h-6 w-2/3 rounded bg-inset" />}
    />
  );
}
