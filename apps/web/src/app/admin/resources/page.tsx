import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { authService } from "../../../lib/services/auth-service";
import { resourceModerationService } from "../../../lib/services/resource-release-control-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import {
  getResourceReleaseControlCopy,
  resourceStatusLabel,
} from "../../../lib/resource-release-control-i18n";
import { formatHistoryDate, parseHistoryPage } from "../../../lib/commerce-history-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Resource moderation | MTA NEXUS",
  robots: { index: false, follow: false },
};
const statuses = ["draft", "pending_review", "published", "suspended", "archived"] as const;
export default async function ResourceModerationPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    status?: string | string[];
    query?: string | string[];
  }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getResourceReleaseControlCopy(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user || (user.role !== "admin" && user.role !== "moderator")) notFound();
  const status = statuses.find((value) => value === query.status);
  const search = typeof query.query === "string" ? query.query.trim().slice(0, 100) : "";
  const result = await resourceModerationService
    .page(user, Math.min(parseHistoryPage(query.page), 1000), status, search)
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 403) notFound();
      throw error;
    });
  const href = (page: number) =>
    `?${new URLSearchParams({ ...(status ? { status } : {}), ...(search ? { query: search } : {}), page: String(page) })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/admin" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.moderation}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.moderationNote}
      </p>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="space-y-1 text-sm text-secondary">
          {copy.search}
          <input
            name="query"
            defaultValue={search}
            maxLength={100}
            className="block rounded-md border border-base bg-surface px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm text-secondary">
          {copy.status}
          <select
            name="status"
            defaultValue={status ?? ""}
            className="block rounded-md border border-base bg-surface px-3 py-2"
          >
            <option value="">{copy.allStates}</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {copy[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary">
          {copy.search}
        </button>
      </form>
      {result.resources.length ? (
        <ul className="space-y-3">
          {result.resources.map((product) => (
            <li key={product.id} className="nexus-panel space-y-2 p-5">
              <Link
                href={`/admin/resources/${encodeURIComponent(product.id)}`}
                className="break-words font-semibold text-accent underline"
              >
                {product.title}
              </Link>
              <p className="text-sm text-secondary">
                {resourceStatusLabel(locale, product.status)} · {product.currentVersion}
              </p>
              <time dateTime={product.updatedAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(product.updatedAt, locale)}
              </time>
            </li>
          ))}
        </ul>
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
