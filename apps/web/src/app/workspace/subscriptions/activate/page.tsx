import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanReviewTerms } from "../../../../components/plan-review-terms";
import { SubscriptionControls } from "../../../../components/subscription-controls";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { subscriptionsService } from "../../../../lib/services/subscriptions-service";
import { subscriptionError, subscriptionsCopy } from "../../../../lib/subscriptions-i18n";
import {
  subscriptionActivationQuery,
  subscriptionPageParams,
} from "../../../../lib/subscriptions-query";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Activate free subscription | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function SubscriptionActivationPage({
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
    const query = subscriptionActivationQuery(subscriptionPageParams(raw)),
      plan = await subscriptionsService.plan(query.planId);
    if (!plan || plan.revision !== query.revision)
      throw new AppError("Plan changed", 409, "SUBSCRIPTION_PLAN_CHANGED");
    if (plan.price !== 0)
      throw new AppError("Payment required", 409, "SUBSCRIPTION_PAYMENT_REQUIRED");
    const scopes =
      plan.scope === "organization"
        ? await subscriptionsService.scopes(actor, query.scopePage)
        : { scopes: [], page: 1, totalPages: 1 };
    const href = (page: number) =>
      `/workspace/subscriptions/activate?${new URLSearchParams({ planId: plan.id, revision: String(plan.revision), scopePage: String(page) })}`;
    return (
      <section className="mx-auto max-w-4xl space-y-6 py-8">
        <Link href="/subscriptions" className="text-accent underline">
          {c.catalog}
        </Link>
        <h1 className="font-display">{c.activate}</h1>
        <PlanReviewTerms terms={plan} locale={locale} />
        <p>
          {c.revision}: {plan.revision} · {plan.scope === "user" ? c.personal : c.organization}
        </p>
        <SubscriptionControls
          action="activate"
          actorId={actor.id}
          planId={plan.id}
          planRevision={plan.revision}
          terms={plan}
          scope={plan.scope}
          scopes={scopes.scopes}
        />
        <nav className="flex gap-4" aria-label={c.organization}>
          {scopes.page > 1 && <Link href={href(scopes.page - 1)}>{c.previous}</Link>}
          {scopes.page < scopes.totalPages && (
            <Link href={href(scopes.page + 1)}>{c.scopeMore}</Link>
          )}
        </nav>
      </section>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && [400, 409].includes(error.statusCode))
      return (
        <section className="space-y-4 py-8">
          <p role="alert">{subscriptionError(locale, error.code)}</p>
          <Link href="/subscriptions">{c.catalog}</Link>
        </section>
      );
    throw error;
  }
}
