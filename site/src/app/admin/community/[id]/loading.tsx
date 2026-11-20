import { moderationCopy } from "../../../../features/community/community-moderation-copy";
import { RouteHonestLoading } from "../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export default async function Loading() {
  const copy = moderationCopy(await getRequestLocale());
  return (
    <RouteHonestLoading
      headingId="admin-community-item-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      leading={<div className="h-24 rounded bg-inset" />}
    />
  );
}
