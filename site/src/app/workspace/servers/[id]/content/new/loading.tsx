import { serverContentCopy } from "../../../../../../features/servers/server-content-copy";
import { RouteHonestLoading } from "../../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

export default async function Loading() {
  const team = serverContentCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="server-content-new-loading-heading"
      title={team.new}
      loadingLabel={team.loading}
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      rows={4}
      leading={<div className="h-10 w-64 rounded bg-inset" />}
    />
  );
}
