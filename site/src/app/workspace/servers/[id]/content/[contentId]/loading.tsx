import { serverContentCopy } from "../../../../../../features/servers/server-content-copy";
import { HonestLoadingShell } from "../../../../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

// Honest loading shell for /workspace/servers/[id]/content/[contentId].
export default async function Loading() {
  const team = serverContentCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8"
      headingId="server-content-detail-loading-heading"
      title={team.title}
      loadingLabel={team.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-64 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
