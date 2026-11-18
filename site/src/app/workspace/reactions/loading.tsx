import { reactionCopy } from "../../../features/community/content-reaction-copy";
import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /workspace/reactions.
export default async function Loading() {
  const copy = reactionCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8"
      headingId="reactions-loading-heading"
      title={copy.my}
      loadingLabel={copy.loading}
      headerClassName="min-w-0 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary"
      statusClassName="mt-2 text-sm text-muted"
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
