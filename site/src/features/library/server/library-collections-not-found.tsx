import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { pageShellMaxXl } from "../../shell/page-shell";
import { libraryCollectionsCopy } from "../library-collections-i18n";

export async function LibraryCollectionsNotFound() {
  const c = libraryCollectionsCopy(await getRequestLocale());
  return (
    <section className={pageShellMaxXl}>
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
