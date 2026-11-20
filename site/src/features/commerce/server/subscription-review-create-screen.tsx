import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { planReviewsService } from "../../../lib/services/commerce/plan-reviews-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { PlanReviewForm } from "../plan-reviews";
import { planReviewsCopy } from "../plan-reviews-i18n";
import { planReviewNewQuery, planReviewsPageParams } from "../plan-reviews-query";
import { planReviewNavLinkClass } from "../plan-reviews-workspace";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
export async function SubscriptionReviewCreateScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, params] = await Promise.all([cookies(), getRequestLocale(), searchParams]),
    c = planReviewsCopy(locale),
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
        retryHref={"/workspace/subscriptions/reviews/new"}
      />
    );
  }

  if (!actor) {
    const query = planReviewsPageParams(params);
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/subscriptions/reviews/new${query.size ? `?${query}` : ""}`}
      />
    );
  }
  let recoveryRetry = "/workspace/subscriptions/reviews/new";
  try {
    const pageQuery = planReviewsPageParams(params);
    recoveryRetry = `/workspace/subscriptions/reviews/new${pageQuery.size ? `?${pageQuery}` : ""}`;
    const query = planReviewNewQuery(pageQuery),
      plan = await planReviewsService.plan(query.planId);
    if (!plan) notFound();
    if (plan.revision !== query.revision)
      return (
        <section className={pageShellClass}>
          <ErrorState
            title={c.planChanged}
            description={c.selectionRecoverHint}
            action={
              <Link href="/subscriptions" className={planReviewNavLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </section>
      );
    const scopes = await planReviewsService.scopes(actor, query.scopePage);
    const { updatedAt, ...input } = plan;
    void updatedAt;
    const href = (page: number) =>
      `/workspace/subscriptions/reviews/new?${new URLSearchParams({ planId: plan.id, revision: String(plan.revision), scopePage: String(page) })}`;
    return (
      <div className={pageShellClass}>
        <Link href="/subscriptions" className={planReviewNavLinkClass}>
          {c.back}
        </Link>
        <h1 className="font-display">{c.newReview}</h1>
        <PlanReviewForm
          key={`${actor.id}:${plan.id}:${plan.revision}:${scopes.page}`}
          plan={input}
          actorId={actor.id}
          scopes={scopes.scopes}
        />
        {plan.scope === "organization" && !scopes.scopes.length ? (
          <EmptyState title={c.noOrganizations} description={c.noOrganizationsHint} />
        ) : null}
        {plan.scope === "organization" && scopes.totalPages > 1 ? (
          <nav aria-label={c.scopeNext} className="flex flex-wrap gap-4 text-sm">
            {scopes.page > 1 ? (
              <Link href={href(scopes.page - 1)} className={planReviewNavLinkClass}>
                {c.previous}
              </Link>
            ) : null}
            <span className="inline-flex min-h-11 items-center">
              {c.page} {scopes.page} {c.of} {scopes.totalPages}
            </span>
            {scopes.page < scopes.totalPages ? (
              <Link href={href(scopes.page + 1)} className={planReviewNavLinkClass}>
                {c.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
        <Link href="/workspace/subscriptions/reviews" className={planReviewNavLinkClass}>
          {c.history}
        </Link>
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className={pageShellClass}>
          <ErrorState
            title={c.invalid}
            description={c.selectionRecoverHint}
            action={
              <Link href="/subscriptions" className={planReviewNavLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </section>
      );
    return (
      <section className={pageShellClass}>
        <Link href="/subscriptions" className={planReviewNavLinkClass}>
          {c.back}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableHint}
          action={
            <Link href={recoveryRetry} className={planReviewNavLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
}
