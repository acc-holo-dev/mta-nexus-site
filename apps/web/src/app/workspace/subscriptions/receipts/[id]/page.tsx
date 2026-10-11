import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanReviewTerms } from "../../../../../components/plan-review-terms";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/auth-service";
import { subscriptionsService } from "../../../../../lib/services/subscriptions-service";
import { formatSubscriptionTime } from "../../../../../lib/subscription-time";
import { subscriptionError, subscriptionsCopy } from "../../../../../lib/subscriptions-i18n";
import {
  subscriptionAccountHref,
  subscriptionPageParams,
  subscriptionsQuery,
} from "../../../../../lib/subscriptions-query";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recorded subscription operation | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function SubscriptionReceiptPage({
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
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-8">
        <h1>{c.signInRequired}</h1>
        <Link href="/auth/login">{c.signIn}</Link>
      </section>
    );
  try {
    const query = subscriptionsQuery(subscriptionPageParams(raw)),
      detail = await subscriptionsService.detail(actor, path.id, query.organizationId),
      r = detail.receipt,
      s = r.subscription;
    return (
      <section className="mx-auto max-w-4xl space-y-6 py-8">
        <Link
          href={subscriptionAccountHref(query.organizationId)}
          className="text-accent underline"
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
        <p role="note" className="text-sm text-secondary">
          {c.notice}
        </p>
        <a
          href={`/api/subscriptions/account/receipts/${encodeURIComponent(r.id)}/export${query.organizationId ? `?${new URLSearchParams({ organizationId: query.organizationId })}` : ""}`}
          className="text-accent underline"
        >
          {c.export}
        </a>
      </section>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && [400, 409].includes(error.statusCode))
      return (
        <section className="space-y-4 py-8">
          <p role="alert">{subscriptionError(locale, error.code)}</p>
          <Link href="/workspace/subscriptions">{c.title}</Link>
        </section>
      );
    throw error;
  }
}
