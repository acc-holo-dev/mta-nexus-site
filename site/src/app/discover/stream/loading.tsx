import { discoveryStreamCopy } from "../../../features/discovery/discovery-stream-copy";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = discoveryStreamCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="discover-stream-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      leading={<div className="h-24 rounded bg-inset" />}
    />
  );
}
