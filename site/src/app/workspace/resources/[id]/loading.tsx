import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).authorResources;
  return (
    <RouteHonestLoading
      headingId="author-resource-loading-heading"
      title={copy.edit}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6"
      headerClassName="border-b border-base pb-6"
      statusClassName="mt-2 text-sm text-muted"
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-32 rounded bg-inset" />}
    />
  );
}
