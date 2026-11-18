import { moderationCopy } from "../../../features/community/community-moderation-copy";
import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /admin/community.
export default async function Loading() {
  const copy = moderationCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headingId="admin-community-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      titleClassName="text-2xl font-extrabold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
