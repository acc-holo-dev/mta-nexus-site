"use client";

import { type ExplicitFxRate, publicPriceEstimates } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { walletWithdrawalCreateSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import {
  typeBlockSpace2,
  typeGrid2Gap4,
  typeSmSecondary,
  typeSmSuccess,
  typeWFullSurfaceBorderP2,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import { parseCommercialAmount } from "../commercial-confirmation";
import { formatFinancialMinor } from "../financial-i18n";
import { getWalletCopy, walletError } from "../wallet-i18n";
import {
  type ConfirmedWalletWithdrawal,
  confirmedWalletWithdrawal,
} from "../wallet-withdraw-confirmation";
import { useWalletProviderSelection } from "./use-wallet-provider-selection";

export function WalletWithdrawForm({
  actorId,
  currency,
  organizationId,
  rates,
}: {
  actorId: string;
  currency: "USD" | "EUR" | "RUB";
  organizationId?: string;
  rates?: readonly ExplicitFxRate[] | null;
}) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const field = useId();
  const router = useRouter();
  const lock = useRef(false);
  const provider = useWalletProviderSelection(actorId, "payout");
  const [amount, setAmount] = useState("10.00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConfirmedWalletWithdrawal | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (provider.status !== "ready") {
      setError(copy.withdrawUnavailable);
      setResult(null);
      return;
    }
    const minor = parseCommercialAmount(amount);
    if (minor === null || minor <= 0 || minor > 100_000_000) {
      setError(copy.invalid);
      setResult(null);
      return;
    }
    const idempotencyKey = `idem_${crypto.randomUUID().replaceAll("-", "")}`;
    const parsed = walletWithdrawalCreateSchema.safeParse({
      amount: minor,
      currency,
      providerId: provider.providerId,
      idempotencyKey,
      ...(organizationId ? { organizationId } : {}),
    });
    if (!parsed.success) {
      setError(copy.invalid);
      setResult(null);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/wallet/withdrawals", {
        ...privateApiRequest({ method: "POST", json: parsed.data }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const confirmed = response.ok
        ? confirmedWalletWithdrawal(body, {
            amount: minor,
            currency,
            providerId: provider.providerId,
            ...(organizationId ? { organizationId } : {}),
          })
        : null;
      if (!confirmed) {
        setError(response.ok ? copy.withdrawFailed : withdrawError(body?.code));
        return;
      }
      setResult(confirmed);
      router.refresh();
    } catch {
      setError(copy.withdrawFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function withdrawError(code: unknown) {
    if (code === "RATE_LIMIT_EXCEEDED" || code === "RATE_LIMITED") return copy.rateLimited;
    if (code === "UNAUTHORIZED" || code === "ACTOR_ID_REQUIRED") return copy.signInRequired;
    if (
      code === "ACTOR_CHANGED" ||
      code === "CONFLICT" ||
      code === "WITHDRAWAL_IDEMPOTENCY_CONFLICT"
    ) {
      return copy.stateChanged;
    }
    if (
      code === "WALLET_WITHDRAW_DISABLED" ||
      code === "WALLET_ENGINE_DISABLED" ||
      code === "NOT_FOUND" ||
      code === "FORBIDDEN"
    ) {
      return copy.withdrawUnavailable;
    }
    return walletError(locale, code);
  }

  return (
    <form className={panelClipSpace4P5} onSubmit={submit}>
      <h2 className={typeXlSemiboldPrimary}>{organizationId ? copy.orgWithdraw : copy.withdraw}</h2>
      <p className={typeSmSecondary} role="note">
        {organizationId ? copy.orgWithdrawFormNote : copy.withdrawFormNote}
      </p>
      {provider.status === "loading" ? (
        <p role="status" className={typeSmSecondary}>
          {copy.providersLoading}
        </p>
      ) : null}
      {provider.status === "unavailable" ? (
        <ErrorState title={copy.withdrawUnavailable} description={copy.providersUnavailable} />
      ) : null}
      <fieldset disabled={busy || provider.status !== "ready"} className={typeGrid2Gap4}>
        <label htmlFor={`${field}-amount`}>
          <span className="block">{copy.amount}</span>
          <input
            id={`${field}-amount`}
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setResult(null);
            }}
            className={typeWFullSurfaceBorderP2}
          />
        </label>
        <label htmlFor={`${field}-currency`}>
          <span className="block">{copy.currency}</span>
          <input
            id={`${field}-currency`}
            readOnly
            value={currency}
            className={typeWFullSurfaceBorderP2}
          />
        </label>
      </fieldset>
      {error ? <ErrorState title={error} description={copy.withdrawFailed} /> : null}
      {result ? (
        <div className={typeBlockSpace2} role="status">
          <p className={typeSmSuccess}>{copy.withdrawSuccess}</p>
          <p>
            {copy.intentId}: {result.intent.id}
          </p>
          <p>
            {copy.status}: {result.intent.status}
          </p>
          <p>{formatFinancialMinor(result.intent.amount, result.intent.currency, locale)}</p>
          {rates !== undefined ? (
            <IntentEstimate
              amount={result.intent.amount}
              copy={copy}
              currency={result.intent.currency}
              locale={locale}
              rates={rates}
            />
          ) : null}
        </div>
      ) : null}
      <Button type="submit" disabled={busy || provider.status !== "ready"}>
        {busy ? copy.withdrawSubmitting : copy.withdrawSubmit}
      </Button>
    </form>
  );
}

function IntentEstimate({
  amount,
  copy,
  currency,
  locale,
  rates,
}: {
  amount: number;
  copy: ReturnType<typeof getWalletCopy>;
  currency: string;
  locale: "en" | "ru";
  rates: readonly ExplicitFxRate[] | null;
}) {
  const lines = publicPriceEstimates({ price: amount, currency }, rates);
  if (lines === undefined) return null;
  if (lines === null) return <p className={typeSmSecondary}>{copy.fxUnavailable}</p>;
  return (
    <ul className={typeSmSecondary}>
      {lines.map((line) => (
        <li key={line.quote}>
          {line.kind === "quote"
            ? copy.fxEstimate.replace(
                "{destination}",
                formatFinancialMinor(line.amount, line.quote, locale),
              )
            : line.kind === "dust"
              ? copy.fxDust
              : line.kind === "invalid"
                ? copy.fxExceeds
                : `${line.quote}: ${copy.fxNone}`}
        </li>
      ))}
    </ul>
  );
}
