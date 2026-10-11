"use client";
import type { commercialFeeEstimate } from "@nexus/domain";
import { type FormEvent, useId, useRef, useState } from "react";
import { formatHistoryAmount } from "../lib/commerce-history-format";
import { parseCommercialAmount } from "../lib/commercial-confirmation";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedSubscriptionEstimate } from "../lib/subscription-confirmation";
import { subscriptionsCopy } from "../lib/subscriptions-i18n";
import { useNexusLocale } from "./locale-context";
export function SubscriptionFeeEstimator({
  actorId,
  organizationId,
}: {
  actorId: string;
  organizationId?: string;
}) {
  const { locale } = useNexusLocale(),
    c = subscriptionsCopy(locale),
    field = useId(),
    lock = useRef(false);
  const [amount, setAmount] = useState("100.00"),
    [currency, setCurrency] = useState<"USD" | "EUR" | "RUB">("USD"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<ReturnType<typeof commercialFeeEstimate> | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const minor = parseCommercialAmount(amount);
    if (minor === null || minor > 100_000_000) {
      setError(c.invalid);
      setResult(null);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(
          `/api/subscriptions/account/estimate?${new URLSearchParams({ amount: String(minor), currency, ...(organizationId ? { organizationId } : {}) })}`,
          privateApiRequest(),
        ),
        body = await response.json().catch(() => null);
      const confirmed = response.ok
        ? confirmedSubscriptionEstimate(
            body,
            minor,
            currency,
            organizationId ? `org:${organizationId}` : `user:${actorId}`,
          )
        : null;
      if (!confirmed) {
        setError(response.ok ? c.estimateFailed : subscriptionErrorForEstimate(body?.code));
        return;
      }
      setResult(confirmed);
    } catch {
      setError(c.estimateFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function subscriptionErrorForEstimate(code: unknown) {
    return code === "RATE_LIMIT_EXCEEDED"
      ? c.rateLimited
      : code === "UNAUTHORIZED"
        ? c.signInRequired
        : code === "NOT_FOUND" || code === "FORBIDDEN"
          ? c.unavailable
          : c.estimateFailed;
  }
  return (
    <form className="nexus-panel space-y-4 p-5" onSubmit={submit}>
      <p className="text-sm text-secondary" role="note">
        {c.feeNote}
      </p>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${field}-amount`}>
          <span className="block">{c.amount}</span>
          <input
            id={`${field}-amount`}
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setResult(null);
            }}
            className="w-full rounded border border-base bg-surface p-2"
          />
        </label>
        <label htmlFor={`${field}-currency`}>
          <span className="block">{c.currency}</span>
          <select
            id={`${field}-currency`}
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value as typeof currency);
              setResult(null);
            }}
            className="w-full rounded border border-base bg-surface p-2"
          >
            {["USD", "EUR", "RUB"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </fieldset>
      <button type="submit" disabled={busy} className="text-accent underline">
        {busy ? c.busy : c.calculate}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <output className="block space-y-2">
          <p>
            {c.rate}: {result.commissionBps / 100}%
          </p>
          <p>
            {c.estimate}: {formatHistoryAmount(result.platformFee, result.currency, locale)}
          </p>
          <p>
            {c.proceeds}: {formatHistoryAmount(result.sellerProceeds, result.currency, locale)}
          </p>
        </output>
      )}
    </form>
  );
}
