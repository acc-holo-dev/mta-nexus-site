import { verificationApplicationsCopy } from "../../../../features/moderation/verification-applications-copy";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = verificationApplicationsCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="verification-history-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      titleClassName="text-xl font-semibold text-primary"
      leading={<div className="h-6 w-2/3 rounded bg-inset" />}
    />
  );
}
