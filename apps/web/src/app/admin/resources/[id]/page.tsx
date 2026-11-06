import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { ResourceModerationControls } from "../../../../components/resource-moderation-controls";
import { formatHistoryDate, parseHistoryPage } from "../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceMediaCopy } from "../../../../lib/resource-media-i18n";
import {
  getResourceReleaseControlCopy,
  resourceModerationLabel,
  resourceStatusLabel,
} from "../../../../lib/resource-release-control-i18n";
import { resourceRequirementsCopy } from "../../../../lib/resource-requirements-i18n";
import { authService } from "../../../../lib/services/auth-service";
import { resourceModerationService } from "../../../../lib/services/resource-release-control-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Moderation decision | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function ResourceModerationDetail({
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
  const copy = getResourceReleaseControlCopy(locale);
  const dictionary = getDictionary(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <PlatformSignIn locale={locale} returnPath={`/admin/resources/${encodeURIComponent(id)}`} />
    );
  if (user.role !== "admin" && user.role !== "moderator") notFound();
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const returnHref =
    pageNumber > 1
      ? `/admin/resources/${encodeURIComponent(id)}?page=${pageNumber}`
      : `/admin/resources/${encodeURIComponent(id)}`;
  let missing = false;
  const result = await resourceModerationService.detail(user, id, pageNumber).catch((error) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) {
      missing = true;
      return null;
    }
    return null;
  });
  if (missing) notFound();
  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
        <Link
          href="/admin/resources"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.moderation}
        </Link>
        <ErrorState
          id="admin-resource-detail-unavailable"
          title={copy.loadUnavailable}
          action={
            <Link
              href={returnHref}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const product = result.product;
  const linkClass =
    "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
      <Link href="/admin/resources" className={linkClass}>
        {copy.moderation}
      </Link>
      <h1 className="break-words font-display text-primary">{product.title}</h1>
      <p className="text-secondary">
        {resourceStatusLabel(locale, product.status)} · {product.currentVersion}
      </p>
      <p role="note" className="text-sm text-secondary">
        {copy.moderationNote}
      </p>
      <div className="flex min-w-0 flex-wrap gap-4">
        <Link href={`/admin/resources/${encodeURIComponent(id)}/media`} className={linkClass}>
          {resourceMediaCopy(locale).title}
        </Link>
        <Link
          href={`/admin/resources/${encodeURIComponent(id)}/requirements`}
          className={linkClass}
        >
          {resourceRequirementsCopy(locale).title}
        </Link>
      </div>
      <ResourceModerationControls
        key={`${id}:${product.updatedAt.toISOString()}`}
        product={{ id, status: product.status, updatedAt: product.updatedAt.toISOString() }}
      />
      <h2 className="text-lg font-semibold text-primary">{copy.history}</h2>
      {result.events.length ? (
        <ol className="min-w-0 space-y-3">
          {result.events.map((event) => (
            <li key={event.id} className="nexus-panel min-w-0 space-y-3 p-5">
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
        <EmptyState
          title={copy.empty}
          description={copy.moderationNote}
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={linkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={linkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
