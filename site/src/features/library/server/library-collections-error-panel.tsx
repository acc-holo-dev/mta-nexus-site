import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { pageShellMaxXl } from "../../shell/page-shell";
import { libraryCollectionError, libraryCollectionsCopy } from "../library-collections-i18n";
import { collectionHref } from "../library-collections-query";
import { libraryCollectionsLinkClass } from "./library-collections-screen-shared";

const recoveryLinkClass = `${libraryCollectionsLinkClass} inline-flex min-h-11 items-center`;

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
    <section className={pageShellMaxXl}>
      <ErrorState
        title={libraryCollectionError(locale, code)}
        description={
          code === "COLLECTION_ITEM_LIMIT" || code === "COLLECTION_LIMIT"
            ? c.capacityErrorDescription
            : c.actionErrorDescription
        }
        action={
          <div className="flex flex-col items-center gap-3">
            {code === "COLLECTION_ITEM_LIMIT" && collectionId ? (
              <Link href={collectionHref(collectionId)} className={recoveryLinkClass}>
                {c.itemLimitNext}
              </Link>
            ) : null}
            {code === "COLLECTION_LIMIT" ? (
              <Link
                href={collectionHref(undefined, "", { status: "archived" })}
                className={recoveryLinkClass}
              >
                {c.archived}
              </Link>
            ) : null}
            <Link href={collectionHref()} className={recoveryLinkClass}>
              {c.title}
            </Link>
          </div>
        }
      />
    </section>
  );
}
