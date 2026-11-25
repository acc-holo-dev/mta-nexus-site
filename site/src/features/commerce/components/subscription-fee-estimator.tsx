"use client";
import type { commercialFeeEstimate, ExplicitFxRate } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import {
  typeBlockSpace2,
  typeGrid2Gap4,
  typeSmMuted,
  typeSmSecondary,
  typeWFullSurfaceBorderP2,
} from "../../shell/type-shell";
import { formatHistoryAmount } from "../commerce-history-format";
import { parseCommercialAmount } from "../commercial-confirmation";
import { confirmedSubscriptionEstimate } from "../subscription-confirmation";
import { subscriptionsCopy } from "../subscriptions-i18n";
import { getWalletCopy } from "../wallet-i18n";
import { RecordedRateEstimate } from "./recorded-rate-estimate";
export function SubscriptionFeeEstimator({
  actorId,
  organizationId,
  rates,
}: {
  actorId: string;
  organizationId?: string;
  rates?: readonly ExplicitFxRate[] | null;
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
    if (code === "RATE_LIMIT_EXCEEDED" || code === "RATE_LIMITED") return c.rateLimited;
    if (code === "UNAUTHORIZED" || code === "ACTOR_ID_REQUIRED") return c.signInRequired;
    if (code === "ACTOR_CHANGED" || code === "CONFLICT") return c.stateChanged;
    if (code === "VALIDATION_ERROR" || code === "SUBSCRIPTION_INVALID") return c.invalid;
    if (code === "NOT_FOUND" || code === "FORBIDDEN") return c.unavailable;
    return c.estimateFailed;
  }
  return (
    <form className={panelClipSpace4P5} onSubmit={submit}>
      <p className={typeSmSecondary} role="note">
        {c.feeNote}
      </p>
      <fieldset disabled={busy} className={typeGrid2Gap4}>
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
            className={typeWFullSurfaceBorderP2}
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
            className={typeWFullSurfaceBorderP2}
          >
            {["USD", "EUR", "RUB"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      </fieldset>
      <Button type="submit" variant="outline" isLoading={busy} className="min-h-11">
        {busy ? c.busy : c.calculate}
      </Button>
      {error ? <ErrorState title={error} description={c.formErrorHint} /> : null}
      {result && (
        <output className={typeBlockSpace2}>
          {rates === null ? (
            <p role="note" className={typeSmMuted}>
              {getWalletCopy(locale === "ru" ? "ru" : "en").recordedRateUnavailable}
            </p>
          ) : null}
          <p>
            {c.rate}: {result.commissionBps / 100}%
          </p>
          <p>
            {c.estimate}: {formatHistoryAmount(result.platformFee, result.currency, locale)}
          </p>
          <RecordedRateEstimate
            amount={result.platformFee}
            currency={result.currency}
            locale={locale === "ru" ? "ru" : "en"}
            rates={rates === null ? undefined : rates}
          />
          <p>
            {c.proceeds}: {formatHistoryAmount(result.sellerProceeds, result.currency, locale)}
          </p>
          <RecordedRateEstimate
            amount={result.sellerProceeds}
            currency={result.currency}
            locale={locale === "ru" ? "ru" : "en"}
            rates={rates === null ? undefined : rates}
          />
        </output>
      )}
    </form>
  );
}
