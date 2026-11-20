import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { contextTrustCopy } from "../../../../features/trust/public-context-trust-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = contextTrustCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="context-trust-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      rowClassName="h-24 max-w-full rounded bg-inset"
    />
  );
}
