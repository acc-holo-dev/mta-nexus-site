import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { ResourceModerationControls } from "../../../../components/resource-moderation-controls";
import { authService } from "../../../../lib/services/auth-service";
import { resourceModerationService } from "../../../../lib/services/resource-release-control-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import {
  getResourceReleaseControlCopy,
  resourceModerationLabel,
  resourceStatusLabel,
} from "../../../../lib/resource-release-control-i18n";
import { formatHistoryDate, parseHistoryPage } from "../../../../lib/commerce-history-format";

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
  const copy = getResourceReleaseControlCopy(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user || (user.role !== "admin" && user.role !== "moderator")) notFound();
  const result = await resourceModerationService
    .detail(user, id, Math.min(parseHistoryPage(query.page), 1000))
    .catch((error) => {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  const product = result.product;
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/admin/resources" className="text-sm text-accent underline">
        {copy.moderation}
      </Link>
      <h1 className="break-words font-display text-primary">{product.title}</h1>
      <p className="text-secondary">
        {resourceStatusLabel(locale, product.status)} · {product.currentVersion}
      </p>
      <p role="note" className="text-sm text-secondary">
        {copy.moderationNote}
      </p>
      <ResourceModerationControls
        key={`${id}:${product.updatedAt.toISOString()}`}
        product={{ id, status: product.status, updatedAt: product.updatedAt.toISOString() }}
      />
      <h2 className="text-lg font-semibold text-primary">{copy.history}</h2>
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
