import { AppError, RESOURCE_DELIVERY_STATUSES } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { formatHistoryDate } from "../../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceDeliveriesCopy } from "../../../../../lib/resource-deliveries-i18n";
import {
  deliverySearchParams,
  publisherDeliveriesQuery,
} from "../../../../../lib/resource-deliveries-query";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceDeliveriesService } from "../../../../../lib/services/resource-deliveries-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).publisherTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function PublisherDeliveriesPage({
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
  const copy = resourceDeliveriesCopy(locale),
    dictionary = getDictionary(locale),
    returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    for (const part of Array.isArray(value) ? value : [value]) returnParams.append(key, part);
  }
  const basePath = `/workspace/resources/${encodeURIComponent(id)}/deliveries`;
  const returnQuery = returnParams.toString();
  const returnPath = returnQuery ? `${basePath}?${returnQuery}` : basePath;
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let query: ReturnType<typeof publisherDeliveriesQuery>;
  try {
    query = publisherDeliveriesQuery(deliverySearchParams(raw));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <section className="space-y-4 py-8">
        <p role="alert">{copy.invalid}</p>
        <Link
          href={`/workspace/resources/${encodeURIComponent(id)}/deliveries`}
          className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.publisherTitle}
        </Link>
      </section>
    );
  }
  const result = await resourceDeliveriesService.publisher(user, id, query).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={navLinkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const href = (page: number) =>
    `?${new URLSearchParams({ days: query.days, page: String(page) })}`;
  const filtered = query.days !== "all";
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.publisherTitle}</h1>
      <h2 className="break-words text-xl text-primary">{result.product.title}</h2>
      <p role="note" className="text-sm text-secondary">
        {copy.publisherNote}
      </p>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          {copy.days}
          <select name="days" defaultValue={query.days} className={fieldClass}>
            {["all", "7", "30", "90", "365"].map((days) => (
              <option key={days} value={days}>
                {days === "all" ? copy.periodAll : `${days} ${copy.dayCount}`}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="min-h-11 text-sm">
          {copy.apply}
        </Button>
      </form>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["all", ...RESOURCE_DELIVERY_STATUSES] as const).map((status) => (
          <div key={status} className="nexus-panel p-4">
            <dt className="text-xs text-muted">{status === "all" ? copy.total : copy[status]}</dt>
            <dd className="text-2xl text-primary">{result.counts[status]}</dd>
          </div>
        ))}
      </dl>
      {result.items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="py-3 text-left font-semibold">{copy.versions}</caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  {copy.version}
                </th>
                {RESOURCE_DELIVERY_STATUSES.map((status) => (
                  <th key={status} scope="col" className="p-3">
                    {copy[status]}
                  </th>
                ))}
                <th scope="col" className="p-3">
                  {copy.startedAt}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={`${row.buildId}:${row.version}`} className="border-t border-base">
                  <th scope="row" className="break-words p-3">
                    {row.version}
                  </th>
                  {RESOURCE_DELIVERY_STATUSES.map((status) => (
                    <td key={status} className="p-3">
                      {row[status]}
                    </td>
                  ))}
                  <td className="p-3">
                    <time dateTime={row.lastStartedAt.toISOString()}>
                      {formatHistoryDate(row.lastStartedAt, locale)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={result.counts.all === 0 ? copy.publisherEmptyNever : copy.emptyFiltered}
          description={
            result.counts.all === 0 ? copy.publisherEmptyNeverHint : copy.emptyFilteredHint
          }
          action={
            filtered && result.counts.all > 0 ? (
              <Link
                href={`?${new URLSearchParams({ days: "all", page: "1" })}`}
                className={navLinkClass}
              >
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={navLinkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={navLinkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
