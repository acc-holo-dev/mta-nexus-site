import { HonestLoadingShell } from "../../../features/shell/honest-loading";
import { getDictionary } from "../../../lib/platform/i18n";
import { getRequestLocale } from "../../../lib/platform/i18n-server";

// Honest loading shell for /articles/[slug].
export default async function Loading() {
  const copy = getDictionary(await getRequestLocale()).articles;
  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      headingId="article-loading-heading"
      title={copy.title}
      loadingLabel={copy.loading}
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-72 max-w-full rounded bg-inset" />
        <div className="h-40 rounded bg-inset" />
        <div className="h-64 rounded bg-inset" />
      </div>
    </HonestLoadingShell>
  );
}
