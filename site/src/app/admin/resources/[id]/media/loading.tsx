import { resourceMediaCopy } from "../../../../../features/resources/resource-media-i18n";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = resourceMediaCopy(locale);
  const admin = getDictionary(locale).admin;
  return (
    <RouteHonestLoading
      headingId="admin-resource-media-loading-heading"
      title={copy.title}
      loadingLabel={admin.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      rows={4}
      leading={<div className="h-10 w-72 rounded bg-inset" />}
    />
  );
}
