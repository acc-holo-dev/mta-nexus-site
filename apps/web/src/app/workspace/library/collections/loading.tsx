import { getRequestLocale } from "../../../../lib/i18n-server";
import { libraryCollectionsCopy } from "../../../../lib/library-collections-i18n";

export default async function Loading() {
  const copy = libraryCollectionsCopy(await getRequestLocale());
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="nexus-panel mx-auto min-h-40 max-w-4xl space-y-3 p-6 text-sm text-muted"
    >
      <p className="font-medium text-foreground">{copy.title}</p>
      <p>{copy.loading}</p>
    </div>
  );
}
