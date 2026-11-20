import { moderationCopy } from "../../../../../features/community/community-moderation-copy";
import { moderatedDiscussionCopy } from "../../../../../features/community/moderated-discussion-copy";
import { RouteHonestLoading } from "../../../../../features/shell/route-honest-loading-server";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export default async function Loading() {
  const locale = await getRequestLocale();
  const title = moderatedDiscussionCopy(locale).title;
  const loading = moderationCopy(locale).loading;
  return (
    <RouteHonestLoading
      headingId="admin-discussion-loading-heading"
      title={title}
      loadingLabel={loading}
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      titleClassName="text-2xl font-extrabold text-primary"
      leading={<div className="h-24 rounded bg-inset" />}
    />
  );
}
