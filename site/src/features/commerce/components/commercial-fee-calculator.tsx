"use client";
import { COMMERCIAL_CURRENCIES, type CommercialCurrency } from "@nexus/domain";
import { Button, ErrorState, fieldClassBlock } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import {
  typeGridGap3Sm2,
  typeNumericPrimary,
  typeSmMuted,
  typeSmSecondary,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import { formatHistoryAmount } from "../commerce-history-format";
import { confirmedCommercialEstimate, parseCommercialAmount } from "../commercial-confirmation";
import { commercialError, getCommercialCopy } from "../commercial-i18n";

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
    <section className={panelClipSpace4P5} aria-labelledby={`${field}-heading`}>
      <h2 id={`${field}-heading`} className={typeXlSemiboldPrimary}>
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
              className={fieldClassBlock}
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
              className={fieldClassBlock}
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
              className={fieldClassBlock}
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
        <Button type="submit" isLoading={busy} className="min-h-11">
          {busy ? copy.calculating : copy.calculate}
        </Button>
      </form>
      {error ? <ErrorState title={error} description={copy.formErrorHint} /> : null}
      {result ? (
        <div role="status">
          <dl className={typeGridGap3Sm2}>
            <div>
              <dt className="text-muted">{copy.fee}</dt>
              <dd className={typeNumericPrimary}>
                {formatHistoryAmount(result.platformFee, result.currency, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{copy.proceeds}</dt>
              <dd className={typeNumericPrimary}>
                {formatHistoryAmount(result.sellerProceeds, result.currency, locale)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      <p className={typeSmSecondary}>{copy.hold}</p>
      <p role="note" className={typeSmMuted}>
        {copy.estimateNote}
      </p>
    </section>
  );
}
