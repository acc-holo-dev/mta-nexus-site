import { authorPublicationDeskCopy } from "../../../features/community/author-publication-desk-copy";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="publication-desk-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip"
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-32 rounded bg-inset" />}
    />
  );
}
