"use client";
import { type CommercialPlan, commercialFeeEstimate, type PlanReviewCommand } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { planReviewCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { formatHistoryAmount } from "../lib/commerce-history-format";
import { commercialTerms, parseCommercialAmount } from "../lib/commercial-confirmation";
import { confirmedPlanReview } from "../lib/plan-review-confirmation";
import { planReviewError, planReviewsCopy } from "../lib/plan-reviews-i18n";
import { planReviewHref } from "../lib/plan-reviews-query";
import { privateApiRequest } from "../lib/private-api-request";
import { useNexusLocale } from "./locale-context";
import { PlanReviewTerms } from "./plan-review-terms";
export function PlanReviewForm({
  plan,
  actorId,
  scopes,
}: {
  plan: Omit<CommercialPlan, "updatedAt">;
  actorId: string;
  scopes: { id: string; name: string }[];
}) {
  const { locale } = useNexusLocale(),
    c = planReviewsCopy(locale),
    router = useRouter(),
    field = useId(),
    lock = useRef(false),
    request = useRef<PlanReviewCommand | null>(null);
  const [amount, setAmount] = useState("100.00"),
    [currency, setCurrency] = useState<"USD" | "EUR" | "RUB">(plan.currency),
    [organizationId, setOrganization] = useState(scopes[0]?.id ?? "");
  const [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [error, setError] = useState("");
  const minor = parseCommercialAmount(amount),
    estimate =
      minor === null || minor > 100_000_000
        ? null
        : commercialFeeEstimate(minor, currency, plan.commissionBps);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const parsed = planReviewCommandSchema.safeParse(
      request.current ?? {
        requestId: crypto.randomUUID(),
        planId: plan.id,
        expectedRevision: plan.revision,
        grossAmount: minor,
        currency,
        ...(plan.scope === "organization" ? { organizationId } : {}),
      },
    );
    if (!parsed.success) {
      setError(c.invalid);
      return;
    }
    request.current = parsed.data;
    setFrozen(true);
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
          "/api/subscriptions/reviews",
          privateApiRequest({ method: "POST", json: request.current }),
        ),
        body = await response.json().catch(() => null);
      const id = response.ok
        ? confirmedPlanReview(body, request.current, actorId, commercialTerms(plan))
        : null;
      if (!id) {
        setError(planReviewError(locale, body?.code));
        return;
      }
      router.push(planReviewHref(id, request.current.organizationId));
      router.refresh();
    } catch {
      setError(c.retry);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="nexus-panel space-y-5 p-5">
      <PlanReviewTerms terms={plan} locale={locale} />
      <p className="text-sm">
        {c.revision} {plan.revision} · {plan.scope === "user" ? c.personal : c.organization}
      </p>
      <p role="note" className="text-sm text-secondary">
        {c.notice}
      </p>
      <fieldset disabled={busy || frozen} className="grid gap-4 sm:grid-cols-2">
        {plan.scope === "organization" ? (
          <label htmlFor={`${field}-org`} className="space-y-2">
            <span>{c.organization}</span>
            <select
              id={`${field}-org`}
              required
              value={organizationId}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full rounded border border-base bg-surface p-2"
            >
              <option value="">—</option>
              {scopes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label htmlFor={`${field}-amount`} className="space-y-2">
          <span>{c.amount}</span>
          <input
            id={`${field}-amount`}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            maxLength={14}
            className="w-full rounded border border-base bg-surface p-2"
          />
        </label>
        <label htmlFor={`${field}-currency`} className="space-y-2">
          <span>{c.currency}</span>
          <select
            id={`${field}-currency`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
            className="w-full rounded border border-base bg-surface p-2"
          >
            {["USD", "EUR", "RUB"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {estimate ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt>{c.fee}</dt>
            <dd>{formatHistoryAmount(estimate.platformFee, currency, locale)}</dd>
          </div>
          <div>
            <dt>{c.proceeds}</dt>
            <dd>{formatHistoryAmount(estimate.sellerProceeds, currency, locale)}</dd>
          </div>
        </dl>
      ) : null}
      <p className="text-sm text-muted">{c.baseline}</p>
      {frozen ? (
        <p role="note" className="text-sm text-muted">
          {c.frozen}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || (plan.scope === "organization" && !organizationId)}
        isLoading={busy}
      >
        {busy ? c.saving : c.save}
      </Button>
    </form>
  );
}
