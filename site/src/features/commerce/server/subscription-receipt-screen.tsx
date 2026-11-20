import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { subscriptionsService } from "../../../lib/services/commerce/subscriptions-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax5xl } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeSmSecondary } from "../../shell/type-shell";
import { PlanReviewTerms } from "../plan-reviews-workspace";
import { formatSubscriptionTime } from "../subscription-time";
import { subscriptionNavLinkClass } from "../subscription-workspace";
import { subscriptionError, subscriptionsCopy } from "../subscriptions-i18n";
import {
  subscriptionAccountHref,
  subscriptionPageParams,
  subscriptionReceiptHref,
  subscriptionsQuery,
} from "../subscriptions-query";

export async function subscriptionReceiptMetadata(): Promise<Metadata> {
  return {
    title: `${subscriptionsCopy(await getRequestLocale()).recorded} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function SubscriptionReceiptScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, path, raw] = await Promise.all([
      cookies(),
      getRequestLocale(),
      params,
      searchParams,
    ]),
    c = subscriptionsCopy(locale),
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
        retryHref={subscriptionReceiptHref(path.id)}
      />
    );
  }

  if (!actor) {
    const pageParams = subscriptionPageParams(raw);
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={subscriptionReceiptHref(path.id, pageParams.get("organizationId") ?? undefined)}
      />
    );
  }
  let recoveryRetry = subscriptionReceiptHref(path.id);
  try {
    const pageParams = subscriptionPageParams(raw);
    recoveryRetry = subscriptionReceiptHref(path.id, pageParams.get("organizationId") ?? undefined);
    const query = subscriptionsQuery(pageParams),
      detail = await subscriptionsService.detail(actor, path.id, query.organizationId),
      r = detail.receipt,
      s = r.subscription;
    return (
      <section className={pageShellMax5xl}>
        <Link
          href={subscriptionAccountHref(query.organizationId)}
          className={subscriptionNavLinkClass}
        >
          {c.title}
        </Link>
        <h1 className="font-display">{c.recorded}</h1>
        <p>
          {c.actions[r.action]} · {formatSubscriptionTime(r.createdAt, locale)}
        </p>
        <p>
          {c.revision}: {s.planRevision}
        </p>
        <p>
          {c.started}: {formatSubscriptionTime(s.startedAt, locale)} · {c.expires}:{" "}
          {formatSubscriptionTime(s.expiresAt, locale)}
        </p>
        {s.cancelledAt && (
          <p>
            {c.ended}: {formatSubscriptionTime(s.cancelledAt, locale)}
          </p>
        )}
        <p>
          {c.current}: {c.statuses[detail.current.status]}
        </p>
        <h2>{c.snapshot}</h2>
        <PlanReviewTerms terms={s.terms} locale={locale} />
        <p role="note" className={typeSmSecondary}>
          {c.notice}
        </p>
        <a
          href={`/api/subscriptions/account/receipts/${encodeURIComponent(r.id)}/export${query.organizationId ? `?${new URLSearchParams({ organizationId: query.organizationId })}` : ""}`}
          className={subscriptionNavLinkClass}
        >
          {c.export}
        </a>
      </section>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && [400, 409].includes(error.statusCode))
      return (
        <section className={pageShellMax5xl}>
          <ErrorState
            title={subscriptionError(locale, error.code)}
            description={c.selectionRecoverHint}
            action={
              <Link href="/workspace/subscriptions" className={subscriptionNavLinkClass}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </section>
      );
    return (
      <section className={pageShellMax5xl}>
        <Link href={subscriptionAccountHref(undefined)} className={subscriptionNavLinkClass}>
          {c.title}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableHint}
          action={
            <Link href={recoveryRetry} className={subscriptionNavLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
}
