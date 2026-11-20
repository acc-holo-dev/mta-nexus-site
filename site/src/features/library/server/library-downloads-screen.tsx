import { AppError, RESOURCE_DELIVERY_STATUSES } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceDeliveriesService } from "../../../lib/services/commerce/resource-deliveries-service";
import { ResourceDeliveryEvidence } from "../../resources/delivery-server";
import { ResourceDownloadButton } from "../../resources/download";
import { resourceDeliveriesCopy } from "../../resources/resource-deliveries-i18n";
import {
  deliverySearchParams,
  resourceDeliveriesQuery,
  resourceDeliveriesUrl,
} from "../../resources/resource-deliveries-query";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakSemiboldPrimary,
  typeDisplayPrimary,
  typeFlexWrapBetweenGap2,
  typeFlexWrapEndGap3,
  typeFlexWrapGap3,
  typeFlexWrapGap4,
  typeFlexWrapGap4Sm,
  typeGridGap1Sm,
  typeMinH11Sm,
  typeSmSecondary,
  typeXsMuted,
} from "../../shell/type-shell";

const filterNavClass =
  "inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] aria-[current=page]:bg-accent aria-[current=page]:text-white";

export async function libraryDownloadsMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LibraryDownloadsScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = resourceDeliveriesCopy(locale),
    dictionary = getDictionary(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/workspace/library/downloads"}
      />
    );
  }

  if (!user) {
    let returnPath = "/workspace/library/downloads";
    try {
      returnPath = resourceDeliveriesUrl(resourceDeliveriesQuery(deliverySearchParams(raw)));
    } catch {
      // Keep the list route when filters are invalid for unsigned visitors.
    }
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof resourceDeliveriesQuery>;
  try {
    query = resourceDeliveriesQuery(deliverySearchParams(raw));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <section className={`${pageShellMax5xl} max-w-xl`}>
        <ErrorState
          title={copy.invalid}
          description={copy.invalidHint}
          action={
            <Link href="/workspace/library/downloads" className={linkAccentSm}>
              {copy.title}
            </Link>
          }
        />
      </section>
    );
  }
  const result = await resourceDeliveriesService.page(user, query).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellMax5xl}>
        <Link href="/workspace/library" className={linkAccentSm}>
          {copy.library}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={resourceDeliveriesUrl(query)} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const href = (page: number) => resourceDeliveriesUrl({ ...query, page });
  return (
    <div className={pageShellMax5xl}>
      <Link href="/workspace/library" className={linkAccentSm}>
        {copy.library}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.title}</h1>
      <p role="note" className={typeSmSecondary}>
        {copy.note}
      </p>
      <form method="get" action="/workspace/library/downloads" className={typeFlexWrapEndGap3}>
        {query.resourceId ? (
          <input type="hidden" name="resourceId" value={query.resourceId} />
        ) : null}
        <label className={typeGridGap1Sm}>
          {copy.days}
          <select name="days" defaultValue={query.days} className={fieldClass}>
            {["all", "7", "30", "90", "365"].map((days) => (
              <option key={days} value={days}>
                {days === "all" ? copy.periodAll : `${days} ${copy.dayCount}`}
              </option>
            ))}
          </select>
        </label>
        <label className={typeGridGap1Sm}>
          {copy.title}
          <select name="status" defaultValue={query.status} className={fieldClass}>
            {["all", ...RESOURCE_DELIVERY_STATUSES].map((status) => (
              <option key={status} value={status}>
                {copy[status as "all" | (typeof RESOURCE_DELIVERY_STATUSES)[number]]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className={typeMinH11Sm}>
          {copy.apply}
        </Button>
        {query.resourceId ? (
          <Link
            href={resourceDeliveriesUrl({ ...query, resourceId: null, page: 1 })}
            className={linkAccentSm}
          >
            {copy.reset}
          </Link>
        ) : null}
      </form>
      <nav aria-label={copy.title} className={typeFlexWrapGap3}>
        {(["all", ...RESOURCE_DELIVERY_STATUSES] as const).map((status) => (
          <Link
            key={status}
            href={resourceDeliveriesUrl({ ...query, status, page: 1 })}
            aria-current={query.status === status ? "page" : undefined}
            className={filterNavClass}
          >
            {copy[status]} ({result.counts[status]})
          </Link>
        ))}
      </nav>
      <a
        href={resourceDeliveriesUrl(
          { ...query, page: result.page },
          "/api/library/downloads/export",
        )}
        className={linkAccentSm}
      >
        {copy.export}
      </a>
      {result.items.length ? (
        <ol className="space-y-4">
          {result.items.map((receipt) => (
            <li key={receipt.id} className={panelSpace4P5}>
              <div className={typeFlexWrapBetweenGap2}>
                <h2 className={typeBreakSemiboldPrimary}>
                  {receipt.title ?? copy.privateResource}
                </h2>
                <span className={typeSmSecondary}>{copy[receipt.status]}</span>
              </div>
              <ResourceDeliveryEvidence receipt={receipt} locale={locale} />
              <p className={typeXsMuted}>{receipt.pinned ? copy.fixed : copy.latest}</p>
              <div className={typeFlexWrapGap4}>
                <Link
                  href={`/workspace/library/downloads/${encodeURIComponent(receipt.id)}`}
                  className={linkAccentSm}
                >
                  {copy.details}
                </Link>
                {receipt.downloadable ? (
                  <ResourceDownloadButton
                    productId={receipt.resourceId}
                    buildId={receipt.buildId}
                    version={receipt.version}
                  />
                ) : (
                  <ErrorState
                    id="library-download-unavailable"
                    title={copy.unavailable}
                    description={copy.unavailableHint}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={result.counts.all === 0 ? copy.emptyNever : copy.emptyFiltered}
          description={result.counts.all === 0 ? copy.emptyNeverHint : copy.emptyFilteredHint}
          action={
            result.counts.all > 0 ? (
              <Link
                href={resourceDeliveriesUrl({
                  page: 1,
                  days: "all",
                  status: "all",
                  resourceId: null,
                })}
                className={linkAccentSm}
              >
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className={typeFlexWrapGap4Sm}>
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
