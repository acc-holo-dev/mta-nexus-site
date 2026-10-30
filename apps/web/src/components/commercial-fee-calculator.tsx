"use client";
import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COMMERCIAL_CURRENCIES, type CommercialCurrency } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { privateApiRequest } from "../lib/private-api-request";
import { commercialError, getCommercialCopy } from "../lib/commercial-i18n";
import { confirmedCommercialEstimate, parseCommercialAmount } from "../lib/commercial-confirmation";
import { formatHistoryAmount } from "../lib/commerce-history-format";
import { useNexusLocale } from "./locale-context";

type Plan = { id: string; title: string; revision: number; commissionBps: number };
export function CommercialFeeCalculator({ plans }: { plans: Plan[] }) {
  const { locale } = useNexusLocale(),
    copy = getCommercialCopy(locale),
    field = useId(),
    router = useRouter();
  const lock = useRef(false);
  const [amount, setAmount] = useState("100.00"),
    [currency, setCurrency] = useState<CommercialCurrency>("USD"),
    [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<NonNullable<
    ReturnType<typeof confirmedCommercialEstimate>
  > | null>(null);
  const selected = plans.find((plan) => plan.id === planId);
  function change(action: () => void) {
    action();
    setResult(null);
    setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const minor = parseCommercialAmount(amount);
    if (minor === null || (planId && !selected)) {
      setError(commercialError(locale, "COMMERCIAL_PLAN_INVALID"));
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const query = new URLSearchParams({
        amount: String(minor),
        currency,
        ...(selected ? { planId: selected.id, revision: String(selected.revision) } : {}),
      });
      const response = await fetch(`/api/commerce/estimate?${query}`, privateApiRequest());
      const value: unknown = await response.json();
      if (!response.ok) {
        setError(
          commercialError(
            locale,
            value && typeof value === "object" && "code" in value ? value.code : null,
          ),
        );
        if (response.status === 409) router.refresh();
        return;
      }
      const estimate = confirmedCommercialEstimate(value, minor, currency, selected);
      if (!estimate) {
        setError(commercialError(locale, null));
        return;
      }
      setResult(estimate);
    } catch {
      setError(commercialError(locale, null));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="nexus-panel space-y-4 p-5" aria-labelledby={`${field}-heading`}>
      <h2 id={`${field}-heading`} className="text-xl font-semibold text-primary">
        {copy.calculator}
      </h2>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">
          <label htmlFor={`${field}-amount`} className="space-y-2">
            <span className="text-sm">{copy.gross}</span>
            <input
              id={`${field}-amount`}
              value={amount}
              inputMode="decimal"
              onChange={(event) => change(() => setAmount(event.target.value))}
              required
              className="nexus-input w-full"
            />
          </label>
          <label htmlFor={`${field}-currency`} className="space-y-2">
            <span className="text-sm">{copy.currency}</span>
            <select
              id={`${field}-currency`}
              value={currency}
              onChange={(event) =>
                change(() => setCurrency(event.target.value as CommercialCurrency))
              }
              className="nexus-input w-full"
            >
              {COMMERCIAL_CURRENCIES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${field}-plan`} className="space-y-2">
            <span className="text-sm">{copy.plans}</span>
            <select
              id={`${field}-plan`}
              value={planId}
              onChange={(event) => change(() => setPlanId(event.target.value))}
              className="nexus-input w-full"
            >
              <option value="">{copy.base}</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title} · {copy.revision} {plan.revision}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <Button type="submit" isLoading={busy}>
          {busy ? copy.calculating : copy.calculate}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {result ? (
        <div role="status">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{copy.fee}</dt>
              <dd className="font-numeric text-primary">
                {formatHistoryAmount(result.platformFee, result.currency, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{copy.proceeds}</dt>
              <dd className="font-numeric text-primary">
                {formatHistoryAmount(result.sellerProceeds, result.currency, locale)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      <p className="text-sm text-secondary">{copy.hold}</p>
      <p role="note" className="text-sm text-muted">
        {copy.estimateNote}
      </p>
    </section>
  );
}
