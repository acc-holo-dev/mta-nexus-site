import { AppError, RESOURCE_DELIVERY_STATUSES } from "@nexus/domain";
import { Button, fieldClass } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ResourceDeliveryEvidence } from "../../../../components/resource-delivery-evidence";
import { ResourceDownloadButton } from "../../../../components/resource-download-button";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceDeliveriesCopy } from "../../../../lib/resource-deliveries-i18n";
import {
  deliverySearchParams,
  resourceDeliveriesQuery,
  resourceDeliveriesUrl,
} from "../../../../lib/resource-deliveries-query";
import { authService } from "../../../../lib/services/auth-service";
import { resourceDeliveriesService } from "../../../../lib/services/resource-deliveries-service";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceDeliveriesCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function ResourceDownloadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
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
  let query: ReturnType<typeof resourceDeliveriesQuery>;
  try {
    query = resourceDeliveriesQuery(deliverySearchParams(raw));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <section className="space-y-4 py-8">
        <p role="alert">{copy.invalid}</p>
        <Link href="/workspace/library/downloads" className="text-accent underline">
          {copy.title}
        </Link>
      </section>
    );
  }
  const result = await resourceDeliveriesService.page(user, query),
    href = (page: number) => resourceDeliveriesUrl({ ...query, page });
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/workspace/library" className="text-sm text-accent underline">
        {copy.library}
      </Link>
      <h1 className="font-display text-primary">{copy.title}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.note}
      </p>
      <form
        method="get"
        action="/workspace/library/downloads"
        className="flex flex-wrap items-end gap-3"
      >
        {query.resourceId ? (
          <input type="hidden" name="resourceId" value={query.resourceId} />
        ) : null}
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
        <label className="grid gap-1 text-sm">
          {copy.title}
          <select name="status" defaultValue={query.status} className={fieldClass}>
            {["all", ...RESOURCE_DELIVERY_STATUSES].map((status) => (
              <option key={status} value={status}>
                {copy[status as "all" | (typeof RESOURCE_DELIVERY_STATUSES)[number]]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="text-sm">
          {copy.apply}
        </Button>
        {query.resourceId ? (
          <Link
            href={resourceDeliveriesUrl({ ...query, resourceId: null, page: 1 })}
            className="text-sm text-accent underline"
          >
            {copy.reset}
          </Link>
        ) : null}
      </form>
      <nav aria-label={copy.title} className="flex flex-wrap gap-3">
        {(["all", ...RESOURCE_DELIVERY_STATUSES] as const).map((status) => (
          <Link
            key={status}
            href={resourceDeliveriesUrl({ ...query, status, page: 1 })}
            aria-current={query.status === status ? "page" : undefined}
            className="rounded-md border border-base px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
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
        className="inline-block text-sm text-accent underline"
      >
        {copy.export}
      </a>
      {result.items.length ? (
        <ol className="space-y-4">
          {result.items.map((receipt) => (
            <li key={receipt.id} className="nexus-panel space-y-4 p-5">
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="break-words font-semibold text-primary">
                  {receipt.title ?? copy.privateResource}
                </h2>
                <span className="text-sm text-secondary">{copy[receipt.status]}</span>
              </div>
              <ResourceDeliveryEvidence receipt={receipt} locale={locale} />
              <p className="text-xs text-muted">{receipt.pinned ? copy.fixed : copy.latest}</p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={`/workspace/library/downloads/${encodeURIComponent(receipt.id)}`}
                  className="text-sm text-accent underline"
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
                  <p className="text-xs text-muted">{copy.unavailable}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
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
