import { getResourceReleaseControlCopy } from "../../../../features/library/resource-release-control-i18n";
import { HonestLoadingShell } from "../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";

// Honest loading shell for /admin/resources/[id].
export default async function Loading() {
  const copy = getResourceReleaseControlCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8"
      headingId="admin-resource-detail-loading-heading"
      title={copy.moderation}
      loadingLabel={copy.moderationLoading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-32 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-16 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
