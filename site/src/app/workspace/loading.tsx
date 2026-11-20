import { RouteHonestLoading } from "../../features/shell/route-honest-loading-server";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).workspace;
  return (
    <RouteHonestLoading
      headingId="workspace-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headerClassName="min-w-0 space-y-2"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
