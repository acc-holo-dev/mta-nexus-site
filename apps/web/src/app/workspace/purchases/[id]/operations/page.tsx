import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { OrderCancellationForm } from "../../../../../components/order-cancellation-form";
import { authService } from "../../../../../lib/services/auth-service";
import { orderOperationsService } from "../../../../../lib/services/commercial-plan-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getCommercialCopy } from "../../../../../lib/commercial-i18n";
import {
  formatHistoryAmount,
  formatHistoryDate,
  parseHistoryPage,
} from "../../../../../lib/commerce-history-format";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Order operations | MTA NEXUS",
  robots: { index: false, follow: false },
};
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
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  const result = await orderOperationsService
    .detail(user, id, Math.min(parseHistoryPage(query.page), 1000))
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 404) notFound();
      throw error;
    });
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
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link
        href={`/workspace/purchases/${encodeURIComponent(id)}`}
        className="text-sm text-accent underline"
      >
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
      {result.canCancel ? (
        <OrderCancellationForm
          key={`${id}:${result.order.updatedAt.toISOString()}`}
          orderId={id}
          expectedUpdatedAt={result.order.updatedAt.toISOString()}
        />
      ) : (
        <p className="text-sm text-muted">
          {result.order.status === "cancelled" ? copy.cancelledPayment : copy.cannotCancel}
        </p>
      )}
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
