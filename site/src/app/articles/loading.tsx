import { HonestLoadingShell } from "../../features/shell/honest-loading";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

// Honest loading shell for /articles.
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).articles;
  return (
    <HonestLoadingShell
      className="min-w-0 space-y-8 overflow-x-clip"
      headingId="articles-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
      headerClassName="space-y-2 border-b border-base pb-6"
      titleClassName="text-2xl font-extrabold text-primary sm:text-3xl"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-11 rounded bg-inset" />
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
