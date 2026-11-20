import { ownDiscussionCopy } from "../../../features/community/discussion-workspace-copy";
import { RouteHonestLoading } from "../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export default async function Loading() {
  const copy = ownDiscussionCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="discussions-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      rowClassName="h-24 rounded bg-inset"
      leading={<div className="h-28 rounded bg-inset" />}
    />
  );
}
