import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { formatHistoryDate, parseHistoryPage } from "../../../lib/commerce-history-format";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import {
  getResourceReleaseControlCopy,
  resourceStatusLabel,
} from "../../../lib/resource-release-control-i18n";
import { authService } from "../../../lib/services/auth-service";
import { resourceModerationService } from "../../../lib/services/resource-release-control-service";

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
  const copy = getResourceReleaseControlCopy(locale);
  const dictionary = getDictionary(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <PlatformSignIn locale={locale} returnPath="/admin/resources" />;
  if (user.role !== "admin" && user.role !== "moderator") notFound();
  const status = statuses.find((value) => value === query.status);
  const search = typeof query.query === "string" ? query.query.trim().slice(0, 100) : "";
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const filtersActive = Boolean(status || search);
  const returnHref = (() => {
    const params = new URLSearchParams({
      ...(status ? { status } : {}),
      ...(search ? { query: search } : {}),
      ...(pageNumber > 1 ? { page: String(pageNumber) } : {}),
    });
    return params.size ? `/admin/resources?${params}` : "/admin/resources";
  })();
  let forbidden = false;
  const result = await resourceModerationService
    .page(user, pageNumber, status, search)
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 403) {
        forbidden = true;
        return null;
      }
      return null;
    });
  if (forbidden) notFound();
  const href = (page: number) =>
    `?${new URLSearchParams({ ...(status ? { status } : {}), ...(search ? { query: search } : {}), page: String(page) })}`;

  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.back}
        </Link>
        <ErrorState
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

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
      <Link
        href="/admin"
        className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.moderation}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.moderationNote}
      </p>
      <form className="flex min-w-0 flex-wrap items-end gap-3" method="get">
        <label className="min-w-0 flex-1 space-y-1 text-sm text-secondary sm:min-w-40">
          {copy.search}
          <input
            name="query"
            defaultValue={search}
            maxLength={100}
            className="block min-h-11 w-full min-w-0 rounded-md border border-base bg-surface px-3 py-2"
          />
        </label>
        <label className="space-y-1 text-sm text-secondary">
          {copy.status}
          <select
            name="status"
            defaultValue={status ?? ""}
            className="block min-h-11 rounded-md border border-base bg-surface px-3 py-2"
          >
            <option value="">{copy.allStates}</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {copy[value]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-11">
          {copy.search}
        </Button>
        {filtersActive ? (
          <Link
            href="/admin/resources"
            className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.clearFilters}
          </Link>
        ) : null}
      </form>
      {result.resources.length ? (
        <ul className="space-y-3">
          {result.resources.map((product) => (
            <li key={product.id} className="nexus-panel min-w-0 space-y-2 p-5">
              <Link
                href={`/admin/resources/${encodeURIComponent(product.id)}`}
                className="break-words font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
        <EmptyState
          title={copy.empty}
          description={filtersActive ? copy.clearFilters : copy.moderationNote}
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
          action={
            filtersActive ? (
              <Link
                href="/admin/resources"
                className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.clearFilters}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link
              href={href(result.page - 1)}
              className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={href(result.page + 1)}
              className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
