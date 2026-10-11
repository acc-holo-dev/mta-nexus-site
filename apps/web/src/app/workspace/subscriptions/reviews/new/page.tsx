import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanReviewForm } from "../../../../../components/plan-review-form";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { planReviewsCopy } from "../../../../../lib/plan-reviews-i18n";
import { planReviewNewQuery, planReviewsPageParams } from "../../../../../lib/plan-reviews-query";
import { authService } from "../../../../../lib/services/auth-service";
import { planReviewsService } from "../../../../../lib/services/plan-reviews-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review a plan | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function NewPlanReview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, params] = await Promise.all([cookies(), getRequestLocale(), searchParams]),
    c = planReviewsCopy(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{c.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {c.signIn}
        </Link>
      </section>
    );
  try {
    const query = planReviewNewQuery(planReviewsPageParams(params)),
      plan = await planReviewsService.plan(query.planId);
    if (!plan) notFound();
    if (plan.revision !== query.revision)
      return (
        <section className="space-y-4 py-8">
          <p role="alert">{c.planChanged}</p>
          <Link href="/subscriptions" className="text-accent underline">
            {c.back}
          </Link>
        </section>
      );
    const scopes = await planReviewsService.scopes(actor, query.scopePage);
    const { updatedAt, ...input } = plan;
    void updatedAt;
    const href = (page: number) =>
      `/workspace/subscriptions/reviews/new?${new URLSearchParams({ planId: plan.id, revision: String(plan.revision), scopePage: String(page) })}`;
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8">
        <Link href="/subscriptions" className="text-accent underline">
          {c.back}
        </Link>
        <h1 className="font-display">{c.newReview}</h1>
        <PlanReviewForm
          key={`${plan.id}:${plan.revision}:${scopes.page}`}
          plan={input}
          actorId={actor.id}
          scopes={scopes.scopes}
        />
        {plan.scope === "organization" && !scopes.scopes.length ? <p>{c.noOrganizations}</p> : null}
        {plan.scope === "organization" && scopes.totalPages > 1 ? (
          <nav aria-label={c.scopeNext} className="flex gap-4 text-sm">
            {scopes.page > 1 ? (
              <Link href={href(scopes.page - 1)} className="text-accent underline">
                {c.previous}
              </Link>
            ) : null}
            <span>
              {c.page} {scopes.page} {c.of} {scopes.totalPages}
            </span>
            {scopes.page < scopes.totalPages ? (
              <Link href={href(scopes.page + 1)} className="text-accent underline">
                {c.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
        <Link href="/workspace/subscriptions/reviews" className="text-accent underline">
          {c.history}
        </Link>
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className="space-y-4 py-8">
          <p role="alert">{c.invalid}</p>
          <Link href="/subscriptions" className="text-accent underline">
            {c.back}
          </Link>
        </section>
      );
    throw error;
  }
}
