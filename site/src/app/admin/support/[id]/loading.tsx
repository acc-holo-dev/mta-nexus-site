import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).support;
  return (
    <RouteHonestLoading
      headingId="admin-support-case-loading-heading"
      title={copy.staffQueue}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      headerClassName="space-y-2 border-b border-base pb-6"
      leading={<div className="h-10 w-full max-w-md rounded bg-inset" />}
    />
  );
}
