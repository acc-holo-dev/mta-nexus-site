import { AppError } from "@nexus/domain";
import { Button } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanReviewTerms } from "../../../components/plan-review-terms";
import { SubscriptionControls } from "../../../components/subscription-controls";
import { SubscriptionFeeEstimator } from "../../../components/subscription-fee-estimator";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { subscriptionsService } from "../../../lib/services/subscriptions-service";
import { formatSubscriptionTime } from "../../../lib/subscription-time";
import { subscriptionError, subscriptionsCopy } from "../../../lib/subscriptions-i18n";
import {
  subscriptionAccountHref,
  subscriptionPageParams,
  subscriptionsQuery,
} from "../../../lib/subscriptions-query";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "My subscription | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function SubscriptionAccountPage({
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
    const query = subscriptionsQuery(subscriptionPageParams(raw)),
      [result, scopes] = await Promise.all([
        subscriptionsService.dashboard(actor, query.organizationId),
        subscriptionsService.scopes(actor, query.scopePage),
      ]),
      s = result.subscription;
    const historyHref = subscriptionAccountHref(query.organizationId).replace(
      "/workspace/subscriptions",
      "/workspace/subscriptions/history",
    );
    return (
      <section className="mx-auto max-w-4xl space-y-6 py-8">
        <h1 className="font-display">{c.title}</h1>
        <nav className="flex flex-wrap gap-4">
          <Link href="/subscriptions" className="text-accent underline">
            {c.catalog}
          </Link>
          <Link href={historyHref} className="text-accent underline">
            {c.history}
          </Link>
        </nav>
        <p role="note" className="text-sm text-secondary">
          {c.notice}
        </p>
        <form method="get" className="flex flex-wrap gap-3">
          <label htmlFor="subscription-account">
            {c.account}
            <select
              id="subscription-account"
              name="organizationId"
              defaultValue={query.organizationId ?? ""}
              className="ml-3 rounded border border-base bg-surface p-2"
            >
              <option value="">{c.personal}</option>
              {query.organizationId &&
                !scopes.scopes.some((scope) => scope.id === query.organizationId) && (
                  <option value={query.organizationId}>{result.scope.name}</option>
                )}
              {scopes.scopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="ghost" className="h-auto px-0 text-accent underline">
            {c.open}
          </Button>
        </form>
        {scopes.page > 1 && (
          <Link
            href={`${subscriptionAccountHref(query.organizationId)}${query.organizationId ? "&" : "?"}scopePage=${scopes.page - 1}`}
          >
            {c.previous}
          </Link>
        )}
        {scopes.page < scopes.totalPages && (
          <Link
            href={`${subscriptionAccountHref(query.organizationId)}${query.organizationId ? "&" : "?"}scopePage=${scopes.page + 1}`}
          >
            {c.scopeMore}
          </Link>
        )}
        <p>
          {c.rate}: {result.commissionBps / 100}% · {c.hold}: {result.initialHoldDays} {c.days}
        </p>
        <p>{c.noRenewal}</p>
        {s ? (
          <div className="space-y-4">
            <h2>{locale === "ru" ? s.terms.titleRu : s.terms.titleEn}</h2>
            <p>
              {c.status}: {c.statuses[s.status]}
            </p>
            <p>
              {c.started}: {formatSubscriptionTime(s.startedAt, locale)} · {c.expires}:{" "}
              {formatSubscriptionTime(s.expiresAt, locale)}
            </p>
            {s.cancelledAt && (
              <p>
                {c.ended}: {formatSubscriptionTime(s.cancelledAt, locale)}
              </p>
            )}
            <PlanReviewTerms terms={s.terms} locale={locale} />
            {s.status === "expired" && <p role="note">{c.expiredNote}</p>}
            {s.status === "active" && (
              <SubscriptionControls
                action="cancel"
                actorId={actor.id}
                planId={s.planId}
                planRevision={s.planRevision}
                terms={s.terms}
                subscriptionId={s.id}
                organizationId={query.organizationId}
                startedAt={s.startedAt.toISOString()}
                expiresAt={s.expiresAt.toISOString()}
              />
            )}
          </div>
        ) : (
          <p>{c.empty}</p>
        )}
        <SubscriptionFeeEstimator
          actorId={actor.id}
          key={query.organizationId ?? actor.id}
          organizationId={query.organizationId}
        />
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
