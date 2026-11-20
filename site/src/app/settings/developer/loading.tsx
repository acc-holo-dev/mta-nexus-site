import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).settings;
  return (
    <RouteHonestLoading
      headingId="developer-settings-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
