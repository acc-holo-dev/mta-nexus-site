import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

// Honest loading shell for /servers.
export default async function Loading() {
  const dictionary = getDictionary(await getRequestLocale());
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-8 overflow-x-clip"
      headingId="servers-loading-heading"
      title={dictionary.servers.title}
      loadingLabel={dictionary.servers.loading}
      headerClassName="space-y-2 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary sm:text-3xl"
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
