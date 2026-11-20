import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { planReviewsService } from "../../../lib/services/commerce/plan-reviews-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { PlanReviewDetailView } from "../plan-review-detail";
import { planReviewsCopy } from "../plan-reviews-i18n";
import { planReviewHref, planReviewsPageParams, planReviewsQuery } from "../plan-reviews-query";
import { planReviewNavLinkClass } from "../plan-reviews-workspace";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
export async function subscriptionReviewDetailMetadata(): Promise<Metadata> {
  return {
    title: `${planReviewsCopy(await getRequestLocale()).saved} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function SubscriptionReviewDetailScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, { id }, query] = await Promise.all([
      cookies(),
      getRequestLocale(),
      params,
      searchParams,
    ]),
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
        retryHref={planReviewHref(id)}
      />
    );
  }

  if (!actor) {
    const pageParams = planReviewsPageParams(query);
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={planReviewHref(id, pageParams.get("organizationId") ?? undefined)}
      />
    );
  }
  let recoveryRetry = planReviewHref(id);
  try {
    const pageParams = planReviewsPageParams(query);
    recoveryRetry = planReviewHref(id, pageParams.get("organizationId") ?? undefined);
    const selection = planReviewsQuery(pageParams, true),
      detail = await planReviewsService.detail(actor, id, selection.organizationId);
    return (
      <div className={pageShellClass}>
        <PlanReviewDetailView
          detail={detail}
          locale={locale}
          organizationId={selection.organizationId}
        />
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
              <Link href="/workspace/subscriptions/reviews" className={planReviewNavLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </section>
      );
    return (
      <section className={pageShellClass}>
        <Link href="/workspace/subscriptions/reviews" className={planReviewNavLinkClass}>
          {c.title}
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
