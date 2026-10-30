import { AppError } from "@nexus/domain";
import { Button } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { formatHistoryDate } from "../../../../lib/commerce-history-format";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceCartReceiptsCopy } from "../../../../lib/resource-cart-receipts-i18n";
import {
  resourceCartReceiptQuery,
  resourceCartReceiptsUrl,
  resourceCartReceiptUrl,
} from "../../../../lib/resource-cart-receipts-query";
import { authService } from "../../../../lib/services/auth-service";
import { resourceCartReceiptsService } from "../../../../lib/services/resource-cart-receipts-service";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCartReceiptsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function ResourceCartReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]),
    copy = resourceCartReceiptsCopy(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  let query: ReturnType<typeof resourceCartReceiptQuery>;
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value)) for (const item of value) params.append(key, item);
      else if (value !== undefined) params.append(key, value);
    }
    query = resourceCartReceiptQuery(params);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <section className="space-y-4 py-8">
        <p role="alert">{copy.invalid}</p>
        <Link href="/workspace/acquisitions/receipts" className="text-accent underline">
          {copy.title}
        </Link>
      </section>
    );
  }
  const result = await resourceCartReceiptsService.page(user, query);
  const current = { ...query, page: result.page };
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/workspace/cart" className="text-accent underline">
          {copy.cart}
        </Link>
        <Link href="/workspace/acquisitions" className="text-accent underline">
          {copy.history}
        </Link>
        <Link href="/workspace/library" className="text-accent underline">
          {copy.library}
        </Link>
      </nav>
      <h1 className="font-display text-primary">{copy.title}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.note}
      </p>
      <form
        method="get"
        action="/workspace/acquisitions/receipts"
        className="flex flex-wrap items-end gap-4"
      >
        <label className="space-y-2 text-sm">
          <span className="block">{copy.days}</span>
          <select
            name="days"
            defaultValue={String(query.days)}
            className="rounded-md border border-base bg-surface p-2"
          >
            {(["all", 7, 30, 90, 365] as const).map((days) => (
              <option key={days} value={days}>
                {days === "all" ? copy.allTime : `${days} ${copy.dayCount}`}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="block">{copy.evidence}</span>
          <select
            name="evidence"
            defaultValue={query.evidence}
            className="rounded-md border border-base bg-surface p-2"
          >
            {(["all", "reviewed", "legacy"] as const).map((evidence) => (
              <option key={evidence} value={evidence}>
                {copy[evidence]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline" className="text-sm">
          {copy.apply}
        </Button>
      </form>
      {!result.items.length ? (
        <p className="nexus-panel p-6 text-secondary">{copy.empty}</p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.requestId} className="nexus-panel space-y-3 p-5">
              <h2 className="font-semibold">
                <Link
                  href={resourceCartReceiptUrl(item.requestId)}
                  className="text-accent underline"
                  prefetch={false}
                >
                  {copy.receipt}
                </Link>
              </h2>
              <p className="text-sm">{item.reviewed ? copy.reviewed : copy.legacy}</p>
              <p className="text-sm">
                {copy.items}: {item.itemCount}
              </p>
              <time dateTime={item.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(item.createdAt, locale)}
              </time>
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-muted">
        {copy.receipts}: {result.total}
      </p>
      <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
        {result.page > 1 ? (
          <Link
            href={resourceCartReceiptsUrl({ ...current, page: result.page - 1 })}
            className="text-accent underline"
          >
            {copy.previous}
          </Link>
        ) : null}
        <span>
          {copy.page} {result.page} {copy.of} {result.totalPages}
        </span>
        {result.page < result.totalPages ? (
          <Link
            href={resourceCartReceiptsUrl({ ...current, page: result.page + 1 })}
            className="text-accent underline"
          >
            {copy.next}
          </Link>
        ) : null}
        <a
          href={resourceCartReceiptsUrl(current, true).replace("receipts?", "receipts/export?")}
          className="text-accent underline"
        >
          {copy.export}
        </a>
      </nav>
    </div>
  );
}
