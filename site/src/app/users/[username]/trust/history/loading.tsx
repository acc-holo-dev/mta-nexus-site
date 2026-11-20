import { approvalCopy } from "../../../../../features/trust/public-verification-history-copy";
import { getRequestLocale } from "../../../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = approvalCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="user-trust-history-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
    />
  );
}
