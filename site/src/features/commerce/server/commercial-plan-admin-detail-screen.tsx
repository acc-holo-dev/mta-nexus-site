import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { commercialPlanService } from "../../../lib/services/commerce/commercial-plan-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkMinH } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakDisplayPrimary,
  typeFlexWrapGap4Sm,
  typeMinSpace4,
  typePrewrapSmSecondary,
  typeSemiboldPrimary,
  typeSmMuted,
  typeSmSecondary,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../commerce-history-format";
import { commercialTerms } from "../commercial-confirmation";
import { getCommercialCopy } from "../commercial-i18n";
import { CommercialPlanForm } from "../commercial-plans";

export async function commercialPlanAdminDetailMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).versionsDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function CommercialPlanAdminDetailScreen({
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
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={dictionary.errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/commerce/plans/"}
      />
    );
  }

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
      <div className={pageShellMax4xl}>
        <Link href="/admin/commerce/plans" className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSm}>
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
    <div className={pageShellMax4xl}>
      <Link href="/admin/commerce/plans" className={linkAccentSm}>
        {copy.back}
      </Link>
      <h1 className={typeBreakDisplayPrimary}>{locale === "ru" ? plan.titleRu : plan.titleEn}</h1>
      <p className={typeSmSecondary}>
        {copy[plan.status]} · {copy.revision} {plan.revision} · {plan.slug} · {copy[plan.scope]}
      </p>
      <CommercialPlanForm
        key={`${user.id}:${plan.id}:${plan.revision}`}
        actorId={user.id}
        plan={editor}
      />
      <section aria-labelledby="plan-history" className={typeMinSpace4}>
        <h2 id="plan-history" className={typeXlSemiboldPrimary}>
          {copy.history} ({result.total})
        </h2>
        <ol className="space-y-3">
          {result.history.map((version) => (
            <li key={version.revision} className={panelMinSpace3P5}>
              <h3 className={typeSemiboldPrimary}>
                {copy.revision} {version.revision} · {copy[version.status]}
              </h3>
              <time dateTime={version.createdAt.toISOString()} className={typeSmMuted}>
                {formatHistoryDate(version.createdAt, locale)}
              </time>
              <p className="break-words text-sm text-primary">
                {locale === "ru" ? version.terms.titleRu : version.terms.titleEn}
              </p>
              <p className={typePrewrapSmSecondary}>
                {locale === "ru" ? version.terms.descriptionRu : version.terms.descriptionEn}
              </p>
              <p className={typeSmSecondary}>
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
        <nav aria-label={copy.page} className={typeFlexWrapGap4Sm}>
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={linkAccentSm}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={linkAccentSm}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
