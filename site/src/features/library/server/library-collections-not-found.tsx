import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { libraryCollectionsCopy } from "../library-collections-i18n";

export async function LibraryCollectionsNotFound() {
  const c = libraryCollectionsCopy(await getRequestLocale());
  return (
    <section className="mx-auto min-w-0 max-w-xl space-y-4 overflow-x-clip py-16">
      <h1 className="font-display text-primary">{c.notFound}</h1>
      <Link
        href="/workspace/library/collections"
        className="inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {c.title}
      </Link>
    </section>
  );
}
