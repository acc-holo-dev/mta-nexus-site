"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { ActionConfirmCheckbox } from "../../shell/action-confirm-checkbox";
import { useNexusLocale } from "../../shell/locale";
import { typeBlockSpace2, typeSmSuccess } from "../../shell/type-shell";
import { confirmedWalletCheckout } from "../wallet-checkout-confirmation";
import { getWalletCopy, walletError } from "../wallet-i18n";
import {
  useWalletSpendBalance,
  WalletSpendBalancePreview,
  walletSpendSubmitBlocked,
} from "./wallet-spend-balance-preview";

export function WalletCheckoutButton({
  actorId,
  productId,
  amountLabel,
  amountMinor,
  currency,
  signedIn,
  signInHref,
}: {
  actorId: string | null;
  productId: string;
  amountLabel: string;
  amountMinor: number;
  currency: string;
  signedIn: boolean;
  signInHref: string;
}) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const router = useRouter();
  const field = useId();
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const balance = useWalletSpendBalance(actorId ?? "", currency, amountMinor);

  if (!signedIn || !actorId) {
    return (
      <a
        href={signInHref}
        className="flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-bold text-white shadow-nexus transition-colors hover:bg-[var(--nexus-accent-hover)]"
      >
        {copy.checkoutSignIn}
      </a>
    );
  }

  const shortfall = walletSpendSubmitBlocked(balance);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!actorId || !confirmed || shortfall || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/checkout/wallet", {
        ...privateApiRequest({
          method: "POST",
          json: { productIds: [productId] },
          signal: abort.signal,
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      if (abort.signal.aborted) return;
      const confirmedBody = response.ok ? confirmedWalletCheckout(body) : null;
      if (!confirmedBody) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        return;
      }
      setDone({ orderId: confirmedBody.orderId, orderNumber: confirmedBody.orderNumber });
      router.refresh();
    } catch {
      if (!abort.signal.aborted) setError(copy.checkoutFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className={typeBlockSpace2}>
        <p role="status" className={typeSmSuccess}>
          {copy.checkoutSuccess}
        </p>
        <a
          href={`/workspace/purchases/${encodeURIComponent(done.orderId)}`}
          className="flex w-full items-center justify-center rounded-lg border border-base bg-surface py-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
        >
          {copy.checkoutOpenOrder}: {done.orderNumber}
        </a>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit} aria-labelledby={`${field}-heading`}>
      <div className={typeBlockSpace2}>
        <h3 id={`${field}-heading`} className="text-sm font-semibold text-primary">
          {copy.checkoutTitle}
        </h3>
        <p className="text-[11px] text-muted">{copy.checkoutNote}</p>
        <p className="text-sm text-primary">{amountLabel}</p>
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
        {copy.checkoutConfirm}
      </ActionConfirmCheckbox>
      {error ? (
        <ErrorState id={`${field}-error`} title={copy.checkoutFailed} description={error} />
      ) : null}
      <Button
        type="submit"
        disabled={!confirmed || busy || shortfall}
        isLoading={busy}
        className="min-h-11 w-full"
      >
        {busy ? copy.checkoutSubmitting : copy.checkoutSubmit}
      </Button>
    </form>
  );
}
