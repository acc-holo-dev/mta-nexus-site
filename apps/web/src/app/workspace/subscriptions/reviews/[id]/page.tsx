import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanReviewDetailView } from "../../../../../components/plan-review-detail";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { planReviewsCopy } from "../../../../../lib/plan-reviews-i18n";
import { planReviewsPageParams, planReviewsQuery } from "../../../../../lib/plan-reviews-query";
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
    const selection = planReviewsQuery(planReviewsPageParams(query), true),
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
        <section className="space-y-4 py-8">
          <p role="alert">{c.invalid}</p>
          <Link href="/workspace/subscriptions/reviews" className="text-accent underline">
            {c.title}
          </Link>
        </section>
      );
    throw error;
  }
}
