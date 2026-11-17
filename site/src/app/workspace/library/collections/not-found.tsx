import Link from "next/link";
import { libraryCollectionsCopy } from "../../../../features/library/library-collections-i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
export default async function NotFound() {
  const c = libraryCollectionsCopy(await getRequestLocale());
  return (
    <section className="mx-auto max-w-xl space-y-4 py-16">
      <h1>{c.notFound}</h1>
      <Link
        href="/workspace/library/collections"
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {c.title}
      </Link>
    </section>
  );
}
