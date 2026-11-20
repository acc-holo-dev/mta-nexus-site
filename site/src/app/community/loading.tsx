import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";
import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).community;
  return (
    <RouteHonestLoading
      headingId="community-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="min-w-0 space-y-6 overflow-x-clip"
      headerClassName="space-y-2 border-b border-base pb-5"
      rows={5}
      leading={<div className="h-11 rounded bg-inset" />}
    />
  );
}
