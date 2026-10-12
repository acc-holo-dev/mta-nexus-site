import { AppError, LIBRARY_COLLECTION_COMPARISON_FILTERS } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryCollectionItemCopyForm } from "../../../../../../components/library-collection-item-copy";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { libraryCollectionComparisonCopy } from "../../../../../../lib/library-collection-comparison-i18n";
import {
  libraryCollectionComparisonQuery,
  libraryCollectionComparisonSuffix,
} from "../../../../../../lib/library-collection-comparison-query";
import {
  libraryCollectionsCopy,
  libraryCollectionError,
} from "../../../../../../lib/library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
} from "../../../../../../lib/library-collections-query";
import { authService } from "../../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionComparisonCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, { id }, raw] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const c = libraryCollectionsCopy(locale),
    h = libraryCollectionComparisonCopy(locale),
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
    const query = libraryCollectionComparisonQuery(collectionPageParams(raw));
    const report = await libraryCollectionsService.comparison(actor, id, query),
      comparison = report.comparison;
    const suffix = (page: number) => libraryCollectionComparisonSuffix({ ...query, page });
    const transferable = comparison?.items.filter((item) => item.inSource) ?? [];
    const writableDestination =
      comparison?.destination.status === "active" && comparison.destination.revision < 2147483647;
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={h.title}>
          <Link href={collectionHref(id)} className="text-accent underline">
            {c.back}
          </Link>
          <Link href={collectionHref()} className="text-accent underline">
            {c.title}
          </Link>
        </nav>
        <h1 className="font-display">{h.title}</h1>
        <p className="text-secondary">{h.note}</p>
        <section className="nexus-panel space-y-2 p-5">
          <h2 className="break-words font-semibold">
            {c.source}: {report.source.name}
          </h2>
          <p>
            {c[report.source.status]} · {c.revision} {report.source.revision} · {c.items}:{" "}
            {report.source.itemCount} / {report.itemLimit}
          </p>
        </section>
        <form
          method="get"
          action={collectionHref(id, "compare")}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="grid min-w-0 max-w-full gap-1">
            {h.destination}
            <select
              name="to"
              defaultValue={comparison?.destination.id ?? ""}
              required
              className="min-w-0 max-w-full rounded border border-base bg-surface p-2"
            >
              <option value="">{h.choose}</option>
              {report.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name} · {c[target.status]} · {target.itemCount} / {report.itemLimit}
                </option>
              ))}
            </select>
          </label>
          {comparison && (
            <>
              <label className="grid min-w-0 max-w-full gap-1">
                {c.all}
                <select
                  name="filter"
                  defaultValue={comparison.filter}
                  className="min-w-0 max-w-full rounded border border-base bg-surface p-2"
                >
                  {LIBRARY_COLLECTION_COMPARISON_FILTERS.map((filter) => (
                    <option key={filter} value={filter}>
                      {h[filter]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 max-w-full gap-1">
                {c.search}
                <input
                  name="q"
                  defaultValue={comparison.q}
                  maxLength={80}
                  className="min-w-0 max-w-full rounded border border-base bg-surface p-2"
                />
              </label>
            </>
          )}
          <label className="grid min-w-0 max-w-full gap-1">
            {h.transfer}
            <select
              name="transfer"
              defaultValue={comparison?.transfer ?? query.transfer}
              className="min-w-0 max-w-full rounded border border-base bg-surface p-2"
            >
              <option value="copy">{c["copy-items"]}</option>
              <option value="move">{c["move-items"]}</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded border border-base px-3 py-2"
            disabled={!report.targets.length}
          >
            {h.compare}
          </button>
        </form>
        {!comparison ? (
          <p>{report.targets.length ? h.choose : c.noDestination}</p>
        ) : (
          <>
            <section className="nexus-panel space-y-2 p-5">
              <h2 className="break-words font-semibold">
                {c.destination}:{" "}
                <Link
                  href={collectionHref(comparison.destination.id)}
                  className="text-accent underline"
                >
                  {comparison.destination.name}
                </Link>
              </h2>
              <p>
                {c[comparison.destination.status]} · {c.revision} {comparison.destination.revision}{" "}
                · {c.items}: {comparison.destination.itemCount} / {report.itemLimit}
              </p>
            </section>
            <dl className="grid gap-3 sm:grid-cols-5">
              {(
                [
                  ["all", comparison.counts.all],
                  ["source-only", comparison.counts.sourceOnly],
                  ["destination-only", comparison.counts.destinationOnly],
                  ["common", comparison.counts.common],
                  ["unavailable", comparison.counts.unavailable],
                ] as const
              ).map(([key, count]) => (
                <div key={key} className="nexus-panel p-3">
                  <dt className="text-sm text-secondary">{h[key]}</dt>
                  <dd className="text-xl">{count}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              {c.items}: {comparison.total} · {c.page} {comparison.page} {c.of}{" "}
              {comparison.totalPages}
            </p>
            {!comparison.items.length && <p>{c.emptyItems}</p>}
            <table className="w-full table-fixed text-left">
              <thead>
                <tr>
                  <th scope="col" className="p-2">
                    {c.items}
                  </th>
                  <th scope="col" className="p-2">
                    {c.source}
                  </th>
                  <th scope="col" className="p-2">
                    {c.destination}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.items.map((item) => (
                  <tr key={item.productId} className="border-t border-base">
                    <th scope="row" className="break-words p-2 font-normal">
                      {item.available ? (item.title ?? c.unavailable) : c.unavailable}
                      <code className="block break-all text-xs text-muted">{item.productId}</code>
                    </th>
                    <td className="p-2 text-sm">
                      {item.inSource ? c.inCollection : c.notInCollection}
                    </td>
                    <td className="p-2 text-sm">
                      {item.inDestination ? c.inCollection : c.notInCollection}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p role="note" className="text-sm text-muted">
              {h.referenceNote}
            </p>
            {!writableDestination ? (
              <p role="note">{h.destinationReadOnly}</p>
            ) : !transferable.length ? (
              <p role="note">{h.noSourceItems}</p>
            ) : (
              <LibraryCollectionItemCopyForm
                key={`${id}:${report.source.revision}:${comparison.destination.id}:${comparison.destination.revision}:${comparison.page}:${comparison.filter}:${comparison.q}:${comparison.transfer}`}
                locale={locale}
                source={report.source}
                initialDestinationId={comparison.destination.id}
                move={comparison.transfer === "move"}
                items={transferable.map((item) => ({
                  productId: item.productId,
                  title: item.available ? item.title : null,
                }))}
                destinations={[
                  {
                    ...comparison.destination,
                    presentProductIds: transferable
                      .filter((item) => item.inDestination)
                      .map((item) => item.productId),
                  },
                ]}
              />
            )}
            {comparison.totalPages > 1 && (
              <nav aria-label={c.page} className="flex flex-wrap gap-4 text-sm">
                {comparison.page > 1 && (
                  <Link
                    href={`${collectionHref(id, "compare")}?${suffix(comparison.page - 1)}`}
                    className="text-accent underline"
                  >
                    {c.previous}
                  </Link>
                )}
                {comparison.page < comparison.totalPages && (
                  <Link
                    href={`${collectionHref(id, "compare")}?${suffix(comparison.page + 1)}`}
                    className="text-accent underline"
                  >
                    {c.next}
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
        <p className="text-xs text-muted">
          <time dateTime={report.generatedAt}>{report.generatedAt}</time>
        </p>
        <a
          href={`/api/library/collections/${encodeURIComponent(id)}/compare?${suffix(comparison?.page ?? 1)}`}
          className="text-sm text-accent underline"
        >
          {c.json}
        </a>
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    return (
      <section className="mx-auto max-w-xl space-y-4 py-16">
        <p role="alert">{libraryCollectionError(locale, error.code)}</p>
        <Link href={collectionHref(id, "compare")} className="text-accent underline">
          {c.reload}
        </Link>
      </section>
    );
  }
}
