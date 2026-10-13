import { AppError, LIBRARY_COLLECTION_INVENTORY_FILTERS } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { libraryCollectionInventoryCopy } from "../../../../../lib/library-collection-inventory-i18n";
import {
  libraryCollectionInventoryQuery,
  libraryCollectionInventorySuffix,
  collectionInventoryHref,
} from "../../../../../lib/library-collection-inventory-query";
import { collectionHref, collectionPageParams } from "../../../../../lib/library-collections-query";
import {
  libraryCollectionsCopy,
  libraryCollectionError,
} from "../../../../../lib/library-collections-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionInventoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]),
    c = libraryCollectionsCopy(locale),
    v = libraryCollectionInventoryCopy(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{c.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {c.signIn}
        </Link>
      </section>
    );
  try {
    const query = libraryCollectionInventoryQuery(collectionPageParams(raw)),
      report = await libraryCollectionsService.inventory(actor, query),
      suffix = (page: number) => libraryCollectionInventorySuffix({ ...query, page });
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <nav className="flex flex-wrap gap-4">
          <Link href={collectionHref()} className="text-accent underline">
            {c.title}
          </Link>
          <Link href="/workspace/library" className="text-accent underline">
            {c.library}
          </Link>
        </nav>
        <h1>{v.title}</h1>
        <p className="text-secondary">{v.note}</p>
        <form
          method="get"
          action={collectionInventoryHref()}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="grid gap-1">
            {v.search}
            <input
              name="q"
              defaultValue={report.q}
              maxLength={80}
              className="rounded border border-base bg-surface p-2"
            />
          </label>
          <label className="grid gap-1">
            {v.status}
            <select
              name="status"
              defaultValue={report.status}
              className="rounded border border-base bg-surface p-2"
            >
              {(["all", "active", "archived"] as const).map((status) => (
                <option key={status} value={status}>
                  {c[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            {v.collection}
            <select
              name="collectionId"
              defaultValue={report.collectionId ?? ""}
              className="rounded border border-base bg-surface p-2"
            >
              <option value="">{c.all}</option>
              {report.collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name} · {c[collection.status]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            {v.filter}
            <select
              name="filter"
              defaultValue={report.filter}
              className="rounded border border-base bg-surface p-2"
            >
              {LIBRARY_COLLECTION_INVENTORY_FILTERS.map((filter) => (
                <option key={filter} value={filter}>
                  {v[filter]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded border border-base px-3 py-2">
            {v.apply}
          </button>
          <Link href={collectionInventoryHref()} className="text-accent underline">
            {v.clear}
          </Link>
        </form>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {(["resources", "references", "available", "unavailable", "shared"] as const).map(
            (key) => (
              <div key={key} className="nexus-panel p-3">
                <dt>{v[key]}</dt>
                <dd>{report.counts[key]}</dd>
              </div>
            ),
          )}
        </dl>
        <p>
          {c.items}: {report.total} ·{" "}
          <time dateTime={report.generatedAt}>{report.generatedAt}</time>
        </p>
        <a
          href={`/api/library/collections/resources/export?${suffix(report.page)}`}
          className="text-accent underline"
        >
          {v.export}
        </a>
        {!report.items.length && <p>{v.empty}</p>}
        <ol className="space-y-4">
          {report.items.map((item) => {
            const first = item.memberships[0],
              second = item.memberships[1],
              resourceHref = `/workspace/library/${encodeURIComponent(item.productId)}`;
            return (
              <li key={item.productId} className="nexus-panel space-y-3 p-5">
                <h2 className="break-words font-semibold">
                  {item.available ? (item.title ?? c.unavailable) : c.unavailable}
                </h2>
                <code className="block break-all text-xs">{item.productId}</code>
                <p>
                  {item.available ? v.available : v.unavailable} · {v.memberships}:{" "}
                  {item.memberships.length}
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href={`${resourceHref}/collections`} className="text-accent underline">
                    {v.manage}
                  </Link>
                  {item.available && (
                    <Link href={`${resourceHref}/versions`} className="text-accent underline">
                      {c.versions}
                    </Link>
                  )}
                  {first && second && (
                    <Link
                      href={collectionHref(first.id, "compare", { to: second.id })}
                      className="text-accent underline"
                    >
                      {v.compare}
                    </Link>
                  )}
                </div>
                <ul className="space-y-2">
                  {item.memberships.map((membership) => (
                    <li key={membership.id} className="border-t border-base pt-2">
                      <Link
                        href={collectionHref(membership.id)}
                        className="break-words text-accent underline"
                      >
                        {membership.name}
                      </Link>{" "}
                      · {c[membership.status]} · {c.revision} {membership.revision}
                      <p className="text-xs">
                        {c.added}: <time dateTime={membership.addedAt}>{membership.addedAt}</time>
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
        {report.totalPages > 1 && (
          <nav aria-label={c.page} className="flex flex-wrap gap-4">
            {report.page > 1 && (
              <Link
                href={`${collectionInventoryHref()}?${suffix(report.page - 1)}`}
                className="text-accent underline"
              >
                {c.previous}
              </Link>
            )}
            <span>
              {c.page} {report.page} {c.of} {report.totalPages}
            </span>
            {report.page < report.totalPages && (
              <Link
                href={`${collectionInventoryHref()}?${suffix(report.page + 1)}`}
                className="text-accent underline"
              >
                {c.next}
              </Link>
            )}
          </nav>
        )}
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    return (
      <section className="space-y-4 py-16">
        <p role="alert">{libraryCollectionError(locale, error.code)}</p>
        <Link href={collectionInventoryHref()} className="text-accent underline">
          {c.reload}
        </Link>
      </section>
    );
  }
}
