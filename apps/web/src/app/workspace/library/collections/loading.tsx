import { getRequestLocale } from "../../../../lib/i18n-server";
import { libraryCollectionsCopy } from "../../../../lib/library-collections-i18n";
export default async function Loading() {
  const c = libraryCollectionsCopy(await getRequestLocale());
  return (
    <p role="status" className="mx-auto max-w-4xl py-16 text-secondary">
      {c.loading}
    </p>
  );
}
