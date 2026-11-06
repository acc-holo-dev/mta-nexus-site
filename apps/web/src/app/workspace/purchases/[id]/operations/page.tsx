import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderCancellationForm } from "../../../../../components/order-cancellation-form";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../../../../../lib/commerce-history-format";
import { getCommercialCopy } from "../../../../../lib/commercial-i18n";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/auth-service";
import { orderOperationsService } from "../../../../../lib/services/commercial-plan-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Order operations | MTA NEXUS",
  robots: { index: false, follow: false },
};
const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const linkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export default async function OrderOperationsPage({
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
    dictionary = getDictionary(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/purchases/${encodeURIComponent(id)}/operations`}
      />
    );
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000),
    returnHref = `/workspace/purchases/${encodeURIComponent(id)}/operations${pageNumber > 1 ? `?page=${pageNumber}` : ""}`;
  const result = await orderOperationsService.detail(user, id, pageNumber).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link href={`/workspace/purchases/${encodeURIComponent(id)}`} className={linkClass}>
          {copy.back}
        </Link>
        <ErrorState
          id="purchase-operations-load-unavailable"
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
  const states = {
    processing: copy.processing,
    pending: copy.pending,
    authorized: copy.authorized,
    completed: copy.completed,
    failed: copy.failed,
    refunded: copy.refunded,
    partially_refunded: copy.partially_refunded,
    disputed: copy.disputed,
    cancelled: copy.cancelledPayment,
  };
  const status = (value: string) =>
    Object.hasOwn(states, value) ? states[value as keyof typeof states] : copy.unknown;
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/purchases/${encodeURIComponent(id)}`} className={linkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.paymentOperations}</h1>
      <p className="break-words text-secondary">
        {result.order.orderNumber} · {status(result.order.status)}
      </p>
      <p
        role="note"
        className="rounded-lg border border-base bg-surface p-4 text-sm text-secondary"
      >
        {copy.operationsNote}
      </p>
      <OrderCancellationForm
        key={`${user.id}:${id}`}
        actorId={user.id}
        orderId={id}
        expectedUpdatedAt={result.order.updatedAt.toISOString()}
        canCancel={result.canCancel}
      />
      {!result.canCancel ? (
        <ErrorState
          id="order-operations-cannot-cancel"
          title={result.order.status === "cancelled" ? copy.cancelledPayment : copy.cannotCancel}
        />
      ) : null}
      <section aria-labelledby="payment-attempts" className="space-y-4">
        <h2 id="payment-attempts" className="text-xl font-semibold text-primary">
          {copy.attempts} ({result.total})
        </h2>
        {result.attempts.length ? (
          <ol className="space-y-3">
            {result.attempts.map((attempt) => (
              <li key={attempt.id} className="nexus-panel space-y-3 p-5">
                <p className="text-primary">
                  {copy.status}: {status(attempt.status)}
                </p>
                <p className="font-numeric text-secondary">
                  {copy.amount}: {formatHistoryAmount(attempt.amount, attempt.currency, locale)}
                </p>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {(["createdAt", "updatedAt"] as const).map((key) => (
                    <div key={key}>
                      <dt className="text-muted">{copy[key]}</dt>
                      <dd>
                        <time dateTime={attempt[key].toISOString()}>
                          {formatHistoryDate(attempt[key], locale)}
                        </time>
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-secondary">{copy.noAttempts}</p>
        )}
      </section>
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={linkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span>
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
