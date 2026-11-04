import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanReviewDetailView } from "../../../../../components/plan-review-detail";
import {
  planReviewNavLinkClass,
  planReviewPageShellClass,
} from "../../../../../components/plan-review-workspace-recovery";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { planReviewsCopy } from "../../../../../lib/plan-reviews-i18n";
import {
  planReviewHref,
  planReviewsPageParams,
  planReviewsQuery,
} from "../../../../../lib/plan-reviews-query";
import { authService } from "../../../../../lib/services/auth-service";
import { planReviewsService } from "../../../../../lib/services/plan-reviews-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recorded plan terms | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function PlanReviewPage({
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
    dictionary = getDictionary(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
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
      <PlanReviewDetailView
        detail={detail}
        locale={locale}
        organizationId={selection.organizationId}
      />
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className={planReviewPageShellClass}>
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
      <section className={planReviewPageShellClass}>
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
