import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommercialPlanForm } from "../../../../../components/commercial-plan-form";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../../../../../lib/commerce-history-format";
import { commercialTerms } from "../../../../../lib/commercial-confirmation";
import { getCommercialCopy } from "../../../../../lib/commercial-i18n";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/auth-service";
import { commercialPlanService } from "../../../../../lib/services/commercial-plan-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Commercial plan versions | MTA NEXUS",
  robots: { index: false, follow: false },
};
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
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
  const copy = getCommercialCopy(locale);
  const dictionary = getDictionary(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/admin/commerce/plans/${encodeURIComponent(id)}`}
      />
    );
  if (user.role !== "admin") notFound();
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const returnHref =
    pageNumber > 1
      ? `/admin/commerce/plans/${encodeURIComponent(id)}?page=${pageNumber}`
      : `/admin/commerce/plans/${encodeURIComponent(id)}`;
  let missing = false;
  const result = await commercialPlanService.adminDetail(user, id, pageNumber).catch((error) => {
    if (error instanceof AppError && (error.statusCode === 404 || error.statusCode === 403)) {
      missing = true;
      return null;
    }
    return null;
  });
  if (missing) notFound();
  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
        <Link href="/admin/commerce/plans" className={linkClass}>
          {copy.back}
        </Link>
        <ErrorState
          id="admin-commerce-plan-detail-unavailable"
          title={copy.loadUnavailable}
          action={
            <Link href={returnHref} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
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
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
      <Link href="/admin/commerce/plans" className={linkClass}>
        {copy.back}
      </Link>
      <h1 className="break-words font-display text-primary">
        {locale === "ru" ? plan.titleRu : plan.titleEn}
      </h1>
      <p className="text-sm text-secondary">
        {copy[plan.status]} · {copy.revision} {plan.revision} · {plan.slug} · {copy[plan.scope]}
      </p>
      <CommercialPlanForm
        key={`${user.id}:${plan.id}:${plan.revision}`}
        actorId={user.id}
        plan={editor}
      />
      <section aria-labelledby="plan-history" className="min-w-0 space-y-4">
        <h2 id="plan-history" className="text-xl font-semibold text-primary">
          {copy.history} ({result.total})
        </h2>
        <ol className="space-y-3">
          {result.history.map((version) => (
            <li key={version.revision} className="nexus-panel min-w-0 space-y-3 p-5">
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
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={linkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={linkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
