import { AppError, RESOURCE_DELIVERY_STATUSES } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceDeliveriesService } from "../../../lib/services/commerce/resource-deliveries-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelP4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBorderT,
  typeBreakXlPrimary,
  typeDisplayPrimary,
  typeFlexGap4Sm,
  typeFlexWrapEndGap3,
  typeSmSecondary,
  typeWFullLeftSm,
  typeXsMuted,
} from "../../shell/type-shell";
import { resourceDeliveriesCopy } from "../resource-deliveries-i18n";
import { deliverySearchParams, publisherDeliveriesQuery } from "../resource-deliveries-query";

export async function publisherDeliveriesMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).publisherTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function PublisherDeliveriesScreen({
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
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={returnPath}
      />
    );
  }

  if (!user) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let query: ReturnType<typeof publisherDeliveriesQuery>;
  try {
    query = publisherDeliveriesQuery(deliverySearchParams(raw));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <section className={pageShellClass}>
        <ErrorState
          title={copy.invalid}
          description={copy.invalidHint}
          action={
            <Link
              href={`/workspace/resources/${encodeURIComponent(id)}/deliveries`}
              className={linkAccentSm}
            >
              {copy.publisherTitle}
            </Link>
          }
        />
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
        <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnPath} className={linkAccentSm}>
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
      <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={linkAccentSm}>
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.publisherTitle}</h1>
      <h2 className={typeBreakXlPrimary}>{result.product.title}</h2>
      <p role="note" className={typeSmSecondary}>
        {copy.publisherNote}
      </p>
      <form method="get" className={typeFlexWrapEndGap3}>
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
          <div key={status} className={panelP4}>
            <dt className={typeXsMuted}>{status === "all" ? copy.total : copy[status]}</dt>
            <dd className="text-2xl text-primary">{result.counts[status]}</dd>
          </div>
        ))}
      </dl>
      {result.items.length ? (
        <div className="overflow-x-auto">
          <table className={typeWFullLeftSm}>
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
                <tr key={`${row.buildId}:${row.version}`} className={typeBorderT}>
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
                className={linkAccentSm}
              >
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexGap4Sm}>
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkAccentSm}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkAccentSm}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
