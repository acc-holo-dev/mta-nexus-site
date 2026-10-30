import { AppError } from "@nexus/domain";
import { Button } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { subscriptionsService } from "../../../../lib/services/subscriptions-service";
import { formatSubscriptionTime } from "../../../../lib/subscription-time";
import { subscriptionError, subscriptionsCopy } from "../../../../lib/subscriptions-i18n";
import {
  subscriptionAccountHref,
  subscriptionPageParams,
  subscriptionReceiptHref,
  subscriptionsQuery,
} from "../../../../lib/subscriptions-query";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Subscription history | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function SubscriptionHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, raw] = await Promise.all([cookies(), getRequestLocale(), searchParams]),
    c = subscriptionsCopy(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-8">
        <h1>{c.signInRequired}</h1>
        <Link href="/auth/login">{c.signIn}</Link>
      </section>
    );
  try {
    const query = subscriptionsQuery(subscriptionPageParams(raw), "history"),
      result = await subscriptionsService.history(actor, query);
    const href = (page: number) =>
      `/workspace/subscriptions/history?${new URLSearchParams({ page: String(page), days: String(query.days), ...(query.organizationId ? { organizationId: query.organizationId } : {}) })}`;
    return (
      <section className="mx-auto max-w-4xl space-y-6 py-8">
        <Link
          href={subscriptionAccountHref(query.organizationId)}
          className="text-accent underline"
        >
          {c.title}
        </Link>
        <h1 className="font-display">
          {c.history}: {result.scope.name ?? c.personal}
        </h1>
        <form method="get" className="flex gap-4">
          {query.organizationId && (
            <input type="hidden" name="organizationId" value={query.organizationId} />
          )}
          <label htmlFor="subscription-days">
            {c.period}
            <select
              id="subscription-days"
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
          <Button type="submit" variant="ghost" className="h-auto px-0 text-accent underline">
            {c.filter}
          </Button>
        </form>
        <p>
          {c.total}: {result.total}
        </p>
        {result.receipts.length ? (
          <ul className="space-y-4">
            {result.receipts.map((r) => (
              <li key={r.id} className="nexus-panel space-y-2 p-4">
                <Link
                  href={subscriptionReceiptHref(r.id, query.organizationId)}
                  className="text-accent underline"
                >
                  {c.actions[r.action]}: {locale === "ru" ? r.titleRu : r.titleEn}
                </Link>
                <p>
                  {formatSubscriptionTime(r.createdAt, locale)} · {c.revision}: {r.planRevision}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>{c.historyEmpty}</p>
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
          <p role="alert">{subscriptionError(locale, error.code)}</p>
          <Link href="/workspace/subscriptions">{c.title}</Link>
        </section>
      );
    throw error;
  }
}
