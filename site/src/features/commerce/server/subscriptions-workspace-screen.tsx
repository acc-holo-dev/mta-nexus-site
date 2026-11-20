import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { subscriptionsService } from "../../../lib/services/commerce/subscriptions-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { PlanReviewTerms } from "../plan-reviews-workspace";
import {
  SubscriptionControls,
  SubscriptionFeeEstimator,
  SubscriptionRecovery,
} from "../subscription-controls";
import { formatSubscriptionTime } from "../subscription-time";
import { subscriptionNavLinkClass } from "../subscription-workspace";
import { subscriptionError, subscriptionsCopy } from "../subscriptions-i18n";
import {
  subscriptionAccountHref,
  subscriptionPageParams,
  subscriptionsQuery,
} from "../subscriptions-query";

export async function subscriptionsWorkspaceMetadata(): Promise<Metadata> {
  return {
    title: `${subscriptionsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function SubscriptionsWorkspaceScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, raw] = await Promise.all([cookies(), getRequestLocale(), searchParams]),
    c = subscriptionsCopy(locale),
    dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={c.loadUnavailable}
        retryHref={"/workspace/subscriptions"}
      />
    );
  }

  if (!actor) {
    const params = subscriptionPageParams(raw);
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/subscriptions${params.size ? `?${params}` : ""}`}
      />
    );
  }
  let recoveryRetry = "/workspace/subscriptions";
  try {
    const pageParams = subscriptionPageParams(raw);
    recoveryRetry = `/workspace/subscriptions${pageParams.size ? `?${pageParams}` : ""}`;
    const query = subscriptionsQuery(pageParams),
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
      <section className={pageShellClass}>
        <h1 className="font-display">{c.title}</h1>
        <SubscriptionRecovery key={actor.id} actorId={actor.id} />
        <nav className="flex flex-wrap gap-4">
          <Link href="/subscriptions" className={subscriptionNavLinkClass}>
            {c.catalog}
          </Link>
          <Link href={historyHref} className={subscriptionNavLinkClass}>
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
          <Button type="submit" size="touch" variant="outline">
            {c.open}
          </Button>
        </form>
        {scopes.page > 1 && (
          <Link
            href={`${subscriptionAccountHref(query.organizationId)}${query.organizationId ? "&" : "?"}scopePage=${scopes.page - 1}`}
            className={subscriptionNavLinkClass}
          >
            {c.previous}
          </Link>
        )}
        {scopes.page < scopes.totalPages && (
          <Link
            href={`${subscriptionAccountHref(query.organizationId)}${query.organizationId ? "&" : "?"}scopePage=${scopes.page + 1}`}
            className={subscriptionNavLinkClass}
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
            {s.status === "expired" ? (
              <ErrorState
                id="subscription-expired"
                title={c.statuses.expired}
                description={c.expiredNote}
              />
            ) : null}
            {s.status === "active" && (
              <SubscriptionControls
                key={`${actor.id}:${s.id}`}
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
          <EmptyState
            title={c.empty}
            description={c.emptyHint}
            action={
              <Link href="/subscriptions" className={subscriptionNavLinkClass}>
                {c.catalog}
              </Link>
            }
          />
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
        <section className={pageShellClass}>
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
      <section className={pageShellClass}>
        <Link href="/subscriptions" className={subscriptionNavLinkClass}>
          {c.catalog}
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
