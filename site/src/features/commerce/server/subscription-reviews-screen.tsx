import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { planReviewsService } from "../../../lib/services/commerce/plan-reviews-service";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../../lib/services/commerce/wallet-payment-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelFlexWrapEndGap4P4, panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBlockSm,
  typeFlexWrapGap4Sm,
  typeSmSecondary,
  typeSurfaceBorderP2,
} from "../../shell/type-shell";
import { formatHistoryAmount, formatHistoryDate } from "../commerce-history-format";
import { RecordedRateEstimate } from "../components/recorded-rate-estimate";
import { planReviewsCopy } from "../plan-reviews-i18n";
import { planReviewHref, planReviewsPageParams, planReviewsQuery } from "../plan-reviews-query";
import { planReviewNavLinkClass } from "../plan-reviews-workspace";

export async function subscriptionReviewsMetadata(): Promise<Metadata> {
  return {
    title: `${planReviewsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function SubscriptionReviewsScreen({
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
        retryHref={"/workspace/subscriptions/reviews"}
      />
    );
  }

  if (!actor) {
    const query = planReviewsPageParams(params);
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/subscriptions/reviews${query.size ? `?${query}` : ""}`}
      />
    );
  }
  let recoveryRetry = "/workspace/subscriptions/reviews";
  try {
    const pageQuery = planReviewsPageParams(params);
    recoveryRetry = `/workspace/subscriptions/reviews${pageQuery.size ? `?${pageQuery}` : ""}`;
    const normalized = { ...params };
    if (normalized.organizationId === "") delete normalized.organizationId;
    const query = planReviewsQuery(planReviewsPageParams(normalized));
    const [result, scopes] = await Promise.all([
      planReviewsService.page(actor, query),
      planReviewsService.scopes(actor, query.scopePage),
    ]);
    const fxRates = isWalletEngineEnabled()
      ? await new WalletPaymentService().listFxRates().catch(() => null)
      : undefined;
    const href = (page: number, scopePage = scopes.page) =>
      `/workspace/subscriptions/reviews?${new URLSearchParams({ page: String(page), scopePage: String(scopePage), days: String(query.days), ...(query.organizationId ? { organizationId: query.organizationId } : {}) })}`;
    return (
      <div className={pageShellMax5xl}>
        <Link href="/subscriptions" className={planReviewNavLinkClass}>
          {c.back}
        </Link>
        <h1 className="font-display">{c.title}</h1>
        <p role="note" className={typeSmSecondary}>
          {c.notice}
        </p>
        <form method="get" className={panelFlexWrapEndGap4P4}>
          <label htmlFor="review-account">
            <span className={typeBlockSm}>{c.account}</span>
            <select
              id="review-account"
              name="organizationId"
              defaultValue={query.organizationId ?? ""}
              className={typeSurfaceBorderP2}
            >
              <option value="">{c.personal}</option>
              {query.organizationId && !scopes.scopes.some((o) => o.id === query.organizationId) ? (
                <option value={query.organizationId}>{result.scope.name}</option>
              ) : null}
              {scopes.scopes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="review-days">
            <span className={typeBlockSm}>{c.period}</span>
            <select
              id="review-days"
              name="days"
              defaultValue={String(query.days)}
              className={typeSurfaceBorderP2}
            >
              <option value="all">{c.all}</option>
              {[7, 30, 90, 365].map((v) => (
                <option key={v} value={v}>
                  {v} {c.days}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="scopePage" value={scopes.page} />
          <Button type="submit" size="touch" variant="outline">
            {c.apply}
          </Button>
        </form>
        {scopes.totalPages > 1 ? (
          <nav aria-label={c.scopeNext} className={typeFlexWrapGap4Sm}>
            {scopes.page > 1 ? (
              <Link href={href(result.page, scopes.page - 1)} className={planReviewNavLinkClass}>
                {c.previous}
              </Link>
            ) : null}
            <span className={linkMinH}>
              {c.scopeNext} · {scopes.page} / {scopes.totalPages}
            </span>
            {scopes.page < scopes.totalPages ? (
              <Link href={href(result.page, scopes.page + 1)} className={planReviewNavLinkClass}>
                {c.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
        {result.reviews.length ? (
          <ol className="space-y-4">
            {result.reviews.map((r) => (
              <li key={r.id} className={panelSpace3P5}>
                <Link
                  href={planReviewHref(r.id, query.organizationId)}
                  className={`${planReviewNavLinkClass} break-words text-lg`}
                >
                  {locale === "ru" ? r.terms.titleRu : r.terms.titleEn}
                </Link>
                <p className="text-sm">
                  {c.revision} {r.planRevision} ·{" "}
                  <time dateTime={r.createdAt.toISOString()}>
                    {formatHistoryDate(r.createdAt, locale)}
                  </time>
                </p>
                <p className="text-sm">
                  {formatHistoryAmount(r.terms.price, r.terms.currency, locale)} ·{" "}
                  {r.terms.durationDays} {c.days} · {c.commission}: {r.terms.commissionBps / 100}%
                  <RecordedRateEstimate
                    amount={r.terms.price}
                    currency={r.terms.currency}
                    locale={locale}
                    rates={fxRates}
                  />
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title={c.empty} description={c.emptyHint} />
        )}
        {result.totalPages > 1 ? (
          <nav aria-label={c.page} className={typeFlexWrapGap4Sm}>
            {result.page > 1 ? (
              <Link href={href(result.page - 1)} className={planReviewNavLinkClass}>
                {c.previous}
              </Link>
            ) : null}
            <span className={linkMinH}>
              {c.page} {result.page} {c.of} {result.totalPages}
            </span>
            {result.page < result.totalPages ? (
              <Link href={href(result.page + 1)} className={planReviewNavLinkClass}>
                {c.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className={pageShellMax5xl}>
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
      <section className={pageShellMax5xl}>
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
