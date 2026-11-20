import { serverPublicationHistoryCopy } from "../../../../../../../features/servers/server-publication-history-copy";
import { RouteHonestLoading } from "../../../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../../../lib/i18n/server";

export default async function Loading() {
  const copy = serverPublicationHistoryCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="content-history-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip py-8"
      headerClassName=""
      titleClassName="text-xl font-semibold text-primary"
      leading={<div className="h-6 w-2/3 rounded bg-inset" />}
    />
  );
}
