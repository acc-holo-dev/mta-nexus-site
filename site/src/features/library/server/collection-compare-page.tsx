import { AppError, LIBRARY_COLLECTION_COMPARISON_FILTERS } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClassBlock } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { libraryCollectionsService } from "../../../lib/services/library/library-collections-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelClipSpace2P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBorderT,
  typeBreakSemibold,
  typeFlexMinWrapEndGap3,
  typeFlexMinWrapGap4Sm,
  typeMinBreakDisplay,
  typeSmMuted,
  typeSmSecondary,
  typeXsMuted,
} from "../../shell/type-shell";
import { LibraryCollectionItemCopyForm } from "../collection-item-copy";
import { libraryCollectionComparisonCopy } from "../library-collection-comparison-i18n";
import {
  libraryCollectionComparisonQuery,
  libraryCollectionComparisonSuffix,
} from "../library-collection-comparison-query";
import { libraryCollectionError, libraryCollectionsCopy } from "../library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
  collectionId as parseCollectionId,
} from "../library-collections-query";

export async function collectionCompareMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionComparisonCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export async function CollectionComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, { id }, raw] = await Promise.all([getRequestLocale(), params, searchParams]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const c = libraryCollectionsCopy(typedLocale),
    h = libraryCollectionComparisonCopy(typedLocale),
    dictionary = getDictionary(typedLocale);
  let returnPath = collectionHref(id, "compare");
  try {
    const preview = libraryCollectionComparisonQuery(collectionPageParams(raw));
    returnPath = `${returnPath}?${libraryCollectionComparisonSuffix(preview)}`;
  } catch {
    // Invalid filters return to the comparison route.
  }
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    let safeReturn = collectionHref();
    try {
      parseCollectionId(id);
      safeReturn = returnPath;
    } catch {
      /* Keep the collections list. */
    }
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={h.title}
        message={h.loadUnavailable}
        retryHref={safeReturn}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  try {
    const query = libraryCollectionComparisonQuery(collectionPageParams(raw));
    const retryHref = `${collectionHref(id, "compare")}?${libraryCollectionComparisonSuffix(query)}`;
    const report = await libraryCollectionsService
      .comparison(actor, id, query)
      .catch((error: unknown) => {
        if (error instanceof AppError) throw error;
        return null;
      });
    if (!report) {
      return (
        <div className={pageShellMax5xl}>
          <h1 className="font-display">{h.title}</h1>
          <ErrorState
            title={h.loadUnavailable}
            description={h.loadUnavailableDescription}
            action={
              <Link href={retryHref} className={linkAccentSmRounded}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    const comparison = report.comparison;
    const suffix = (page: number) => libraryCollectionComparisonSuffix({ ...query, page });
    const transferable = comparison?.items.filter((item) => item.inSource) ?? [];
    const writableDestination =
      comparison?.destination.status === "active" && comparison.destination.revision < 2147483647;
    return (
      <div className={pageShellMax5xl}>
        <nav className={typeFlexMinWrapGap4Sm} aria-label={h.title}>
          <Link href={collectionHref(id)} className={linkAccentSmRounded}>
            {c.back}
          </Link>
          <Link href={collectionHref()} className={linkAccentSmRounded}>
            {c.title}
          </Link>
        </nav>
        <h1 className={typeMinBreakDisplay}>{h.title}</h1>
        <p className="text-secondary">{h.note}</p>
        <section className={panelClipSpace2P5}>
          <h2 className={typeBreakSemibold}>
            {c.source}: {report.source.name}
          </h2>
          <p>
            {c[report.source.status]} · {c.revision} {report.source.revision} · {c.items}:{" "}
            {report.source.itemCount} / {report.itemLimit}
          </p>
        </section>
        <search aria-label={c.search}>
          <form
            method="get"
            action={collectionHref(id, "compare")}
            className={typeFlexMinWrapEndGap3}
          >
            <label className="grid min-w-0 max-w-full gap-1.5">
              <span className="font-label uppercase text-secondary">{h.destination}</span>
              <select
                name="to"
                defaultValue={comparison?.destination.id ?? ""}
                required
                className={`${fieldClassBlock} min-h-11 min-w-0 max-w-full`}
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
                <label className="grid min-w-0 max-w-full gap-1.5">
                  <span className="font-label uppercase text-secondary">{c.all}</span>
                  <select
                    name="filter"
                    defaultValue={comparison.filter}
                    className={`${fieldClassBlock} min-h-11 min-w-0 max-w-full`}
                  >
                    {LIBRARY_COLLECTION_COMPARISON_FILTERS.map((filter) => (
                      <option key={filter} value={filter}>
                        {h[filter]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid min-w-0 max-w-full gap-1.5">
                  <span className="font-label uppercase text-secondary">{c.search}</span>
                  <input
                    name="q"
                    defaultValue={comparison.q}
                    maxLength={80}
                    className={`${fieldClassBlock} min-h-11 min-w-0 max-w-full`}
                  />
                </label>
              </>
            )}
            <label className="grid min-w-0 max-w-full gap-1.5">
              <span className="font-label uppercase text-secondary">{h.transfer}</span>
              <select
                name="transfer"
                defaultValue={comparison?.transfer ?? query.transfer}
                className={`${fieldClassBlock} min-h-11 min-w-0 max-w-full`}
              >
                <option value="copy">{c["copy-items"]}</option>
                <option value="move">{c["move-items"]}</option>
              </select>
            </label>
            <Button
              type="submit"
              variant="outline"
              size="touch"
              className="px-3"
              disabled={!report.targets.length}
            >
              {h.compare}
            </Button>
          </form>
        </search>
        {!comparison ? (
          <EmptyState
            title={report.targets.length ? h.choose : c.noDestination}
            description={report.targets.length ? h.chooseHint : h.noDestinationHint}
          />
        ) : (
          <>
            <section className={panelClipSpace2P5}>
              <h2 className={typeBreakSemibold}>
                {c.destination}:{" "}
                <Link
                  href={collectionHref(comparison.destination.id)}
                  className={linkAccentSmRounded}
                >
                  {comparison.destination.name}
                </Link>
              </h2>
              <p>
                {c[comparison.destination.status]} · {c.revision} {comparison.destination.revision}{" "}
                · {c.items}: {comparison.destination.itemCount} / {report.itemLimit}
              </p>
            </section>
            <dl className="grid min-w-0 gap-3 overflow-x-clip sm:grid-cols-5">
              {(
                [
                  ["all", comparison.counts.all],
                  ["source-only", comparison.counts.sourceOnly],
                  ["destination-only", comparison.counts.destinationOnly],
                  ["common", comparison.counts.common],
                  ["unavailable", comparison.counts.unavailable],
                ] as const
              ).map(([key, count]) => (
                <div key={key} className="nexus-panel min-w-0 overflow-x-clip p-3">
                  <dt className={typeSmSecondary}>{h[key]}</dt>
                  <dd className="text-xl">{count}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              {c.items}: {comparison.total} · {c.page} {comparison.page} {c.of}{" "}
              {comparison.totalPages}
            </p>
            {!comparison.items.length ? (
              <EmptyState title={c.emptyItems} description={h.emptyHint} />
            ) : null}
            <div className="min-w-0 overflow-x-auto">
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
                    <tr key={item.productId} className={typeBorderT}>
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
            </div>
            <p role="note" className={typeSmMuted}>
              {h.referenceNote}
            </p>
            {!writableDestination ? (
              <ErrorState
                id="library-collection-compare-destination-readonly"
                title={h.destinationReadOnly}
                description={h.destinationReadOnlyHint}
              />
            ) : !transferable.length ? (
              <ErrorState
                id="library-collection-compare-no-source-items"
                title={h.noSourceItems}
                description={h.noSourceItemsHint}
              />
            ) : (
              <LibraryCollectionItemCopyForm
                key={`${id}:${report.source.revision}:${comparison.destination.id}:${comparison.destination.revision}:${comparison.page}:${comparison.filter}:${comparison.q}:${comparison.transfer}`}
                locale={typedLocale}
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
              <nav aria-label={c.page} className={typeFlexMinWrapGap4Sm}>
                {comparison.page > 1 && (
                  <Link
                    href={`${collectionHref(id, "compare")}?${suffix(comparison.page - 1)}`}
                    className={linkAccentSmRounded}
                  >
                    {c.previous}
                  </Link>
                )}
                {comparison.page < comparison.totalPages && (
                  <Link
                    href={`${collectionHref(id, "compare")}?${suffix(comparison.page + 1)}`}
                    className={linkAccentSmRounded}
                  >
                    {c.next}
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
        <p className={typeXsMuted}>
          <time dateTime={report.generatedAt}>{report.generatedAt}</time>
        </p>
        <a
          href={`/api/library/collections/${encodeURIComponent(id)}/compare?${suffix(comparison?.page ?? 1)}`}
          className={linkAccentSmRounded}
        >
          {c.json}
        </a>
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    return (
      <section className={pageShellMax5xl}>
        <ErrorState
          title={libraryCollectionError(typedLocale, error.code)}
          description={h.loadUnavailableDescription}
          action={
            <Link href={collectionHref(id, "compare")} className={linkAccentSmRounded}>
              {c.reload}
            </Link>
          }
        />
      </section>
    );
  }
}
