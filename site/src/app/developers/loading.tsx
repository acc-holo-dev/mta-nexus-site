import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).developers;
  return (
    <RouteHonestLoading
      headingId="developers-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="min-w-0 space-y-6 overflow-x-clip"
      headerClassName="space-y-2 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary"
      rows={4}
      rowClassName="h-24 max-w-full rounded bg-inset"
      leading={<div className="h-11 max-w-full rounded bg-inset" />}
    />
  );
}
