import { getRequestLocale } from "../lib/i18n-server";
import { publicationCopy } from "../lib/publication-feed-copy";
export async function PublicationFeedLoading() {
  const copy = publicationCopy(await getRequestLocale());
  return (
    <div role="status" aria-live="polite" className="nexus-panel min-h-40 p-6 text-sm text-muted">
      {copy.loading}
    </div>
  );
}
