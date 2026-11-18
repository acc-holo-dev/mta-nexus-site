import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

// Honest loading shell for /community.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).community;
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="community-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="space-y-2 border-b border-base pb-5"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        {[1, 2, 3, 4, 5].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
