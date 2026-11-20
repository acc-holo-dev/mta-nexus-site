import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { verificationCopy } from "../../../features/trust/verification-workspace-copy";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = verificationCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="verification-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      titleClassName="text-xl font-semibold text-primary"
      leading={<div className="h-6 w-2/3 rounded bg-inset" />}
    />
  );
}
