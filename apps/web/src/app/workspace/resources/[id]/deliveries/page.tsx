import { AppError, RESOURCE_DELIVERY_STATUSES } from "@nexus/domain";
import { Button } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatHistoryDate } from "../../../../../lib/commerce-history-format";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceDeliveriesCopy } from "../../../../../lib/resource-deliveries-i18n";
import {
  deliverySearchParams,
  publisherDeliveriesQuery,
} from "../../../../../lib/resource-deliveries-query";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceDeliveriesService } from "../../../../../lib/services/resource-deliveries-service";
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
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
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
          className="text-accent underline"
        >
          {copy.publisherTitle}
        </Link>
      </section>
    );
  }
  const result = await resourceDeliveriesService.publisher(user, id, query).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    throw error;
  });
  const href = (page: number) =>
    `?${new URLSearchParams({ days: query.days, page: String(page) })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link
        href={`/workspace/resources/${encodeURIComponent(id)}`}
        className="text-sm text-accent underline"
      >
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
          <select name="days" defaultValue={query.days} className="nexus-input">
            {["all", "7", "30", "90", "365"].map((days) => (
              <option key={days} value={days}>
                {days === "all" ? copy.periodAll : `${days} ${copy.dayCount}`}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="text-sm">
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
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className="text-accent underline">
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className="text-accent underline">
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
