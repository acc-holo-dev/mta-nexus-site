"use client";

import { type ExplicitFxRate, publicPriceEstimates } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { ActionConfirmCheckbox } from "../../shell/action-confirm-checkbox";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import {
  typeBlockSpace2,
  typeSmMuted,
  typeSmSuccess,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import { formatHistoryAmount } from "../commerce-history-format";
import { getWalletCopy, walletError } from "../wallet-i18n";
import { confirmedWalletPay } from "../wallet-pay-confirmation";
import {
  useWalletSpendBalance,
  WalletSpendBalancePreview,
  walletSpendSubmitBlocked,
} from "./wallet-spend-balance-preview";

export function WalletPayOrderForm({
  actorId,
  orderId,
  amountLabel,
  amountMinor,
  currency,
  canPay,
  rates,
}: {
  actorId: string;
  orderId: string;
  amountLabel: string;
  amountMinor: number;
  currency: string;
  canPay: boolean;
  rates?: readonly ExplicitFxRate[] | null;
}) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const router = useRouter();
  const field = useId();
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const scope = `${actorId}:${orderId}`;
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const balance = useWalletSpendBalance(actorId, currency, amountMinor);

  // scope is the recovery identity for actor+order; reset local confirm state on change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is the reset identity.
  useEffect(() => {
    controller.current?.abort();
    lock.current = false;
    setConfirmed(false);
    setBusy(false);
    setError("");
    setDone(false);
  }, [scope]);

  const shortfall = walletSpendSubmitBlocked(balance);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canPay || !confirmed || shortfall || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/pay-with-wallet`, {
        ...privateApiRequest({ method: "POST", json: {}, signal: abort.signal }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      if (abort.signal.aborted) return;
      const confirmedBody = response.ok ? confirmedWalletPay(body) : null;
      if (!confirmedBody || confirmedBody.orderId !== orderId) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      if (!abort.signal.aborted) setError(copy.payFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!canPay) return null;
  if (done) {
    return (
      <p role="status" className={typeSmSuccess}>
        {copy.paySuccess}
      </p>
    );
  }

  return (
    <form className={panelClipSpace4P5} onSubmit={onSubmit} aria-labelledby="wallet-pay-heading">
      <div className={typeBlockSpace2}>
        <h2 id="wallet-pay-heading" className={typeXlSemiboldPrimary}>
          {copy.payTitle}
        </h2>
        <p className="text-secondary">{copy.payNote}</p>
        <p className="text-primary">{amountLabel}</p>
        {rates === undefined ? null : (
          <PayEstimate
            amount={amountMinor}
            copy={copy}
            currency={currency}
            locale={locale}
            rates={rates}
          />
        )}
        <WalletSpendBalancePreview
          balance={balance}
          currency={currency}
          amountMinor={amountMinor}
        />
      </div>
      <ActionConfirmCheckbox
        id={`${field}-confirm`}
        checked={confirmed}
        onCheckedChange={setConfirmed}
        required
      >
        {copy.payConfirm}
      </ActionConfirmCheckbox>
      {error ? (
        <ErrorState id="wallet-pay-error" title={copy.payFailed} description={error} />
      ) : null}
      <Button
        type="submit"
        disabled={!confirmed || busy || shortfall}
        isLoading={busy}
        className="min-h-11"
      >
        {busy ? copy.paying : copy.paySubmit}
      </Button>
    </form>
  );
}

function PayEstimate({
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
  if (lines === null) return <p className={typeSmMuted}>{copy.fxUnavailable}</p>;
  return (
    <ul className={typeSmMuted}>
      {lines.map((line) => (
        <li key={line.quote}>
          {line.kind === "quote"
            ? copy.fxEstimate.replace(
                "{destination}",
                formatHistoryAmount(line.amount, line.quote, locale),
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
