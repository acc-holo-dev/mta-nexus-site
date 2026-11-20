import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).articles;
  return (
    <RouteHonestLoading
      headingId="article-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      rows={0}
      leading={
        <>
          <div className="h-10 w-72 max-w-full rounded bg-inset" />
          <div className="h-40 rounded bg-inset" />
          <div className="h-64 rounded bg-inset" />
        </>
      }
    />
  );
}
