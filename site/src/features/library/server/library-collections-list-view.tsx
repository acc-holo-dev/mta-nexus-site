import { EmptyState, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { libraryCollectionsService as service } from "../../../lib/services/library/library-collections-service";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelSpace2P5, panelSpace3P5 } from "../../shell/panel-shell";
import {
  typeBreakSemibold,
  typeDisplayPrimary,
  typeFlexGap4,
  typeGrid2Gap4,
  typeSmMuted,
  typeSmSecondary,
} from "../../shell/type-shell";
import { LibraryCollectionCommandForm } from "../collection-command";
import { libraryCollectionHistoryCopy } from "../library-collection-history-i18n";
import { libraryCollectionInventoryCopy } from "../library-collection-inventory-i18n";
import { collectionInventoryHref } from "../library-collection-inventory-query";
import { libraryCollectionsCopy } from "../library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
  collectionsQuery,
} from "../library-collections-query";
import { libraryMembershipHistoryCopy } from "../library-membership-history-i18n";
import { membershipHistoryHref } from "../library-membership-history-query";
import {
  type LibraryCollectionsActor,
  LibraryCollectionsPagination,
  type LibraryCollectionsQuery,
  libraryCollectionsLinkClass,
} from "./library-collections-screen-shared";

export async function LibraryCollectionsListView({
  locale,
  actor,
  queryValues,
}: {
  locale: "ru" | "en";
  actor: LibraryCollectionsActor;
  queryValues: LibraryCollectionsQuery;
}) {
  const c = libraryCollectionsCopy(locale);
  const dictionary = getDictionary(locale);
  const query = collectionsQuery(collectionPageParams(queryValues), "list");
  const retryHref = collectionHref(undefined, "", {
    status: query.status,
    page: String(query.page),
  });
  const result = await service.page(actor, query).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellMax4xl}>
        <Link href="/workspace/library" className={libraryCollectionsLinkClass}>
          {c.library}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableDescription}
          action={
            <Link href={retryHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellMax4xl}>
      <Link href="/workspace/library" className={libraryCollectionsLinkClass}>
        {c.library}
      </Link>
      <h1 className={typeDisplayPrimary}>{c.title}</h1>
      <Link href={membershipHistoryHref()} className={libraryCollectionsLinkClass}>
        {libraryMembershipHistoryCopy(locale).history}
      </Link>
      <Link href={collectionInventoryHref()} className={libraryCollectionsLinkClass}>
        {libraryCollectionInventoryCopy(locale).inventory}
      </Link>
      <Link href="/workspace/library/collections/history" className={libraryCollectionsLinkClass}>
        {libraryCollectionHistoryCopy(locale).title}
      </Link>
      <p className={typeSmSecondary}>{c.subtitle}</p>
      <p role="note" className={typeSmMuted}>
        {c.limit}
      </p>
      <section className={panelSpace3P5}>
        <h2 className="font-semibold">{c.create}</h2>
        <LibraryCollectionCommandForm
          key={`create:${actor.id}`}
          actorId={actor.id}
          locale={locale}
        />
      </section>
      <nav aria-label={c.title} className={typeFlexGap4}>
        {(["active", "archived", "all"] as const).map((status) => (
          <Link
            key={status}
            href={collectionHref(undefined, "", { status })}
            aria-current={result.status === status ? "page" : undefined}
            className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=page]:font-bold"
          >
            {c[status]}
          </Link>
        ))}
      </nav>
      {!result.items.length && (
        <EmptyState
          title={result.status === "active" ? c.empty : c.emptyFiltered}
          description={c.subtitle}
          action={
            result.status !== "active" ? (
              <Link
                href={collectionHref()}
                className={`inline-flex min-h-11 items-center ${libraryCollectionsLinkClass}`}
              >
                {c.clear}
              </Link>
            ) : (
              <Link
                href="/market?maxPrice=0"
                className={`inline-flex min-h-11 items-center ${libraryCollectionsLinkClass}`}
              >
                {c.browseLibrary}
              </Link>
            )
          }
        />
      )}
      <ol className={typeGrid2Gap4}>
        {result.items.map((item) => (
          <li key={item.id} className={panelSpace2P5}>
            <h2 className={typeBreakSemibold}>
              <Link href={collectionHref(item.id)} className={libraryCollectionsLinkClass}>
                {item.name}
              </Link>
            </h2>
            <p className="text-sm">
              {c[item.status]} · {c.items}: {item.itemCount} · {c.revision}: {item.revision}
            </p>
          </li>
        ))}
      </ol>
      <LibraryCollectionsPagination
        bounds={result}
        locale={locale}
        href={(page) =>
          collectionHref(undefined, "", { status: result.status, page: String(page) })
        }
      />
      <a
        href={`/api/library/collections?${new URLSearchParams({ status: result.status, page: String(result.page) })}`}
        className={`text-sm ${libraryCollectionsLinkClass}`}
      >
        {c.json}
      </a>
    </div>
  );
}
