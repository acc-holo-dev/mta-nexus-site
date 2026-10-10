import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { CommercialPlanForm } from "../../../../../components/commercial-plan-form";
import { authService } from "../../../../../lib/services/auth-service";
import { commercialPlanService } from "../../../../../lib/services/commercial-plan-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getCommercialCopy } from "../../../../../lib/commercial-i18n";
import { commercialTerms } from "../../../../../lib/commercial-confirmation";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../../../../../lib/commerce-history-format";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Commercial plan versions | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function CommercialPlanAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getCommercialCopy(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (user?.role !== "admin") notFound();
  const result = await commercialPlanService
    .adminDetail(user, id, Math.min(parseHistoryPage(query.page), 1000))
    .catch((error) => {
      if (error instanceof AppError && (error.statusCode === 404 || error.statusCode === 403))
        notFound();
      throw error;
    });
  const { plan } = result;
  const editor = {
    ...commercialTerms(plan),
    id: plan.id,
    slug: plan.slug,
    scope: plan.scope,
    status: plan.status,
    revision: plan.revision,
  };
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/admin/commerce/plans" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <h1 className="break-words font-display text-primary">
        {locale === "ru" ? plan.titleRu : plan.titleEn}
      </h1>
      <p className="text-sm text-secondary">
        {copy[plan.status]} · {copy.revision} {plan.revision} · {plan.slug} · {copy[plan.scope]}
      </p>
      <CommercialPlanForm key={`${plan.id}:${plan.revision}`} plan={editor} />
      <section aria-labelledby="plan-history" className="space-y-4">
        <h2 id="plan-history" className="text-xl font-semibold text-primary">
          {copy.history} ({result.total})
        </h2>
        <ol className="space-y-3">
          {result.history.map((version) => (
            <li key={version.revision} className="nexus-panel space-y-3 p-5">
              <h3 className="font-semibold text-primary">
                {copy.revision} {version.revision} · {copy[version.status]}
              </h3>
              <time dateTime={version.createdAt.toISOString()} className="text-sm text-muted">
                {formatHistoryDate(version.createdAt, locale)}
              </time>
              <p className="break-words text-sm text-primary">
                {locale === "ru" ? version.terms.titleRu : version.terms.titleEn}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                {locale === "ru" ? version.terms.descriptionRu : version.terms.descriptionEn}
              </p>
              <p className="text-sm text-secondary">
                {formatHistoryAmount(version.terms.price, version.terms.currency, locale)} ·{" "}
                {version.terms.durationDays} {copy.days} · {copy.commission}:{" "}
                {(version.terms.commissionBps / 100).toLocaleString(locale)}%
              </p>
              <p className="whitespace-pre-wrap break-words text-sm text-muted">
                {copy.reason}: {version.reason}
              </p>
            </li>
          ))}
        </ol>
      </section>
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className="text-accent underline">
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className="text-accent underline">
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
