import Link from "next/link";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { libraryCollectionsCopy } from "../../../../lib/library-collections-i18n";
export default async function NotFound() {
  const c = libraryCollectionsCopy(await getRequestLocale());
  return (
    <section className="mx-auto max-w-xl space-y-4 py-16">
      <h1>{c.notFound}</h1>
      <Link
        href="/workspace/library/collections"
        className="rounded text-accent underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {c.title}
      </Link>
    </section>
  );
}
