import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatHistoryDate } from "../../../../../lib/commerce-history-format";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceCopyCopy, resourceCopyError } from "../../../../../lib/resource-copy-i18n";
import {
  resourceCopiesPageParams,
  resourceCopiesQuery,
  resourceCopyId,
} from "../../../../../lib/resource-copy-query";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceCopyService } from "../../../../../lib/services/resource-copy-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Draft copies | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function ResourceCopiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, path, raw] = await Promise.all([
      cookies(),
      getRequestLocale(),
      params,
      searchParams,
    ]),
    c = resourceCopyCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-8">
        <h1>{c.signInRequired}</h1>
        <Link href="/auth/login">{c.signIn}</Link>
      </section>
    );
  try {
    const query = resourceCopiesQuery(resourceCopiesPageParams(raw), true),
      id = resourceCopyId(path.id),
      result = await resourceCopyService.page(actor, id, query);
    const base = `/workspace/resources/${encodeURIComponent(id)}/copies`,
      href = (page: number) =>
        `${base}?${new URLSearchParams({ page: String(page), days: String(query.days) })}`;
    return (
      <section className="mx-auto max-w-4xl space-y-6 py-8">
        <Link
          className="text-accent underline"
          href={`/workspace/resources/${encodeURIComponent(id)}`}
        >
          {c.back}
        </Link>
        <h1 className="font-display">
          {c.history}: {result.source.title}
        </h1>
        <form method="get" className="flex flex-wrap gap-4">
          <label htmlFor="copy-days">
            {c.period}
            <select
              id="copy-days"
              name="days"
              defaultValue={String(query.days)}
              className="ml-3 rounded border border-base bg-surface p-2"
            >
              <option value="all">{c.all}</option>
              {[7, 30, 90, 365].map((n) => (
                <option key={n} value={n}>
                  {n} {c.days}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="text-accent underline">
            {c.filter}
          </button>
        </form>
        <p>
          {c.total}: {result.total}
        </p>
        {result.copies.length === 0 ? (
          <p>{c.empty}</p>
        ) : (
          <ul className="space-y-4">
            {result.copies.map((row) => (
              <li key={row.id} className="nexus-panel space-y-2 p-4">
                <Link
                  href={`${base}/${encodeURIComponent(row.id)}`}
                  className="break-words text-accent underline"
                >
                  {row.target.title}
                </Link>
                <p>{row.target.slug}</p>
                <p>
                  {c.created}: {formatHistoryDate(row.createdAt, locale)}
                </p>
                <p>
                  {c.current}:{" "}
                  {c.statuses[row.targetStatus as keyof typeof c.statuses] ?? c.unavailable}
                </p>
                <Link
                  href={`/workspace/resources/${encodeURIComponent(row.target.id)}`}
                  className="text-accent underline"
                >
                  {c.target}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <nav className="flex gap-4" aria-label={c.history}>
          {result.page > 1 && <Link href={href(result.page - 1)}>{c.previous}</Link>}
          <span>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && <Link href={href(result.page + 1)}>{c.next}</Link>}
        </nav>
      </section>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && [400, 409].includes(error.statusCode))
      return (
        <section className="space-y-4 py-8">
          <p role="alert">{resourceCopyError(locale, error.code)}</p>
          <Link href="/workspace/resources" className="text-accent underline">
            {c.back}
          </Link>
        </section>
      );
    throw error;
  }
}
