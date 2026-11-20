import { authorPublicationDeskCopy } from "../../../../features/community/author-publication-desk-copy";
import { getUserPlatformCopy } from "../../../../features/community/user-platform-copy";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const copy = getUserPlatformCopy(locale);
  const desk = authorPublicationDeskCopy(locale);
  return (
    <RouteHonestLoading
      headingId="edit-publication-loading-heading"
      title={copy.edit}
      loadingLabel={desk.loading}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip"
      rowClassName="h-16 rounded bg-inset"
      leading={
        <>
          <div className="h-10 w-40 rounded bg-inset" />
          <div className="h-32 rounded bg-inset" />
        </>
      }
    />
  );
}
