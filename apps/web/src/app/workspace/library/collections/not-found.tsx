import Link from "next/link";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { libraryCollectionsCopy } from "../../../../lib/library-collections-i18n";
export default async function NotFound() {
  const c = libraryCollectionsCopy(await getRequestLocale());
  return (
    <section className="mx-auto max-w-xl space-y-4 py-16">
      <h1>{c.notFound}</h1>
      <Link href="/workspace/library/collections" className="text-accent underline">
        {c.title}
      </Link>
    </section>
  );
}
