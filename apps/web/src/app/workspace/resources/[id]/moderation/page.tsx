import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../../lib/services/auth-service";
import { productService } from "../../../../../lib/services/product-service";
import { resourceModerationService } from "../../../../../lib/services/resource-release-control-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import {
  getResourceReleaseControlCopy,
  resourceModerationLabel,
} from "../../../../../lib/resource-release-control-i18n";
import { formatHistoryDate, parseHistoryPage } from "../../../../../lib/commerce-history-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Publication restrictions | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function PublisherModerationHistory({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getResourceReleaseControlCopy(locale),
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
  const product = await productService.getManagedProduct(id, user);
  if (!product) notFound();
  const result = await resourceModerationService
    .publisherHistory(user, id, Math.min(parseHistoryPage(query.page), 1000))
    .catch((error) => {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link
        href={`/workspace/resources/${encodeURIComponent(id)}`}
        className="text-sm text-accent underline"
      >
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.moderationHistory}</h1>
      <h2 className="break-words text-xl text-primary">{product.title}</h2>
      <p className="text-secondary">{copy[product.status]}</p>
      {product.status === "suspended" ? (
        <p role="note" className="rounded-md border border-base p-4 text-sm text-secondary">
          {copy.publisherNote}
        </p>
      ) : null}
      {result.events.length ? (
        <ol className="space-y-3">
          {result.events.map((event) => (
            <li key={event.id} className="nexus-panel space-y-3 p-5">
              <h3 className="font-semibold text-primary">
                {resourceModerationLabel(locale, event.action)}
              </h3>
              <time dateTime={event.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(event.createdAt, locale)}
              </time>
              {event.reason ? (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {event.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className="text-accent underline">
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className="text-accent underline">
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
