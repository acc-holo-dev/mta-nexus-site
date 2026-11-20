import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { trustCopy } from "../../../../features/trust/public-user-trust-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = trustCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="user-trust-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headerClassName="nexus-panel min-w-0 space-y-3 overflow-x-clip p-6"
      titleClassName="text-xl font-bold text-primary"
      rowClassName="h-24 rounded bg-inset"
    />
  );
}
