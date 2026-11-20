import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).authorResources;
  return (
    <RouteHonestLoading
      headingId="author-resources-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl overflow-x-clip space-y-6 py-8"
      rows={4}
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-10 w-72 rounded bg-inset" />}
    />
  );
}
