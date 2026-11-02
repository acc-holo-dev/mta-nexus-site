import Link from "next/link";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { libraryCollectionsLinkClass } from "./library-collections-screen-shared";

export function LibraryCollectionsErrorPanel({
  locale,
  code,
  collectionId,
}: {
  locale: "ru" | "en";
  code: unknown;
  collectionId?: string;
}) {
  const c = libraryCollectionsCopy(locale);
  return (
    <section className="mx-auto max-w-xl space-y-4 py-16">
      <p role="alert">{libraryCollectionError(locale, code)}</p>
      {code === "COLLECTION_ITEM_LIMIT" && collectionId && (
        <Link href={collectionHref(collectionId)} className={libraryCollectionsLinkClass}>
          {c.itemLimitNext}
        </Link>
      )}
      {code === "COLLECTION_LIMIT" && (
        <Link
          href={collectionHref(undefined, "", { status: "archived" })}
          className={libraryCollectionsLinkClass}
        >
          {c.archived}
        </Link>
      )}
      <Link href={collectionHref()} className={libraryCollectionsLinkClass}>
        {c.title}
      </Link>
    </section>
  );
}
