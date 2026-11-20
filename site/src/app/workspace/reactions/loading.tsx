import { reactionCopy } from "../../../features/community/content-reaction-copy";
import { getRequestLocale } from "../../../lib/i18n/server";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";

export default async function Loading() {
  const copy = reactionCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="reactions-loading-heading"
      title={copy.my}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      leading={<div className="h-24 rounded bg-inset" />}
    />
  );
}
