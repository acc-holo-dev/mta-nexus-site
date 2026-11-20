import { authorPublicationDeskCopy } from "../../../../features/community/author-publication-desk-copy";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="content-new-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip"
      rows={0}
      leading={
        <>
          <div className="h-11 rounded bg-inset" />
          <div className="h-64 rounded bg-inset" />
        </>
      }
    />
  );
}
