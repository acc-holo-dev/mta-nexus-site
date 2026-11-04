import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import {
  subscriptionNavLinkClass,
  subscriptionPageShellClass,
} from "../../../../components/subscription-workspace-recovery";
import { getDictionary } from "../../../../lib/i18n";
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
    dictionary = getDictionary(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) {
    const params = subscriptionPageParams(raw);
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/subscriptions/history${params.size ? `?${params}` : ""}`}
      />
    );
  }
  let recoveryRetry = "/workspace/subscriptions/history";
  try {
    const pageParams = subscriptionPageParams(raw);
    recoveryRetry = `/workspace/subscriptions/history${pageParams.size ? `?${pageParams}` : ""}`;
    const query = subscriptionsQuery(pageParams, "history"),
      result = await subscriptionsService.history(actor, query);
    const href = (page: number) =>
      `/workspace/subscriptions/history?${new URLSearchParams({ page: String(page), days: String(query.days), ...(query.organizationId ? { organizationId: query.organizationId } : {}) })}`;
    return (
      <section className={subscriptionPageShellClass}>
        <Link
          href={subscriptionAccountHref(query.organizationId)}
          className={subscriptionNavLinkClass}
        >
          {c.title}
        </Link>
        <h1 className="font-display">
          {c.history}: {result.scope.name ?? c.personal}
        </h1>
        <form method="get" className="flex flex-wrap gap-4">
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
          <Button type="submit" size="touch" variant="outline">
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
                  className={subscriptionNavLinkClass}
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
          <EmptyState title={c.historyEmpty} description={c.historyEmptyHint} />
        )}
        <nav className="flex flex-wrap gap-4" aria-label={c.history}>
          {result.page > 1 && (
            <Link href={href(result.page - 1)} className={subscriptionNavLinkClass}>
              {c.previous}
            </Link>
          )}
          <span className="inline-flex min-h-11 items-center">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={href(result.page + 1)} className={subscriptionNavLinkClass}>
              {c.next}
            </Link>
          )}
        </nav>
      </section>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && [400, 409].includes(error.statusCode))
      return (
        <section className={subscriptionPageShellClass}>
          <ErrorState
            title={subscriptionError(locale, error.code)}
            description={c.selectionRecoverHint}
            action={
              <Link href="/workspace/subscriptions" className={subscriptionNavLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </section>
      );
    return (
      <section className={subscriptionPageShellClass}>
        <Link href={subscriptionAccountHref(undefined)} className={subscriptionNavLinkClass}>
          {c.title}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableHint}
          action={
            <Link href={recoveryRetry} className={subscriptionNavLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
}
