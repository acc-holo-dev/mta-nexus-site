import { discoveryCopy } from "../../features/discovery/discovery-copy";
import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getRequestLocale } from "../../lib/i18n/server";

// Honest loading shell for /organizations.
export default async function Loading() {
  const copy = discoveryCopy(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-6 overflow-x-clip"
      headingId="organizations-loading-heading"
      title={copy.organizationsTitle}
      loadingLabel={copy.organizationsLoading}
      headerClassName="space-y-2 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 max-w-full rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 max-w-full rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
