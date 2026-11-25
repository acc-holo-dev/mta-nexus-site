"use client";

import { type ExplicitFxRate, publicPriceEstimates } from "@nexus/domain";
import { Button, ErrorState, Input } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { ActionConfirmCheckbox } from "../../shell/action-confirm-checkbox";
import { useNexusLocale } from "../../shell/locale";
import { typeBlockSpace2, typeSmSuccess } from "../../shell/type-shell";
import { formatHistoryAmount } from "../commerce-history-format";
import { confirmedPromoQuote, confirmedWalletCheckout } from "../wallet-checkout-confirmation";
import { getWalletCopy, walletError } from "../wallet-i18n";
import {
  useWalletSpendBalance,
  WalletSpendBalancePreview,
  walletSpendSubmitBlocked,
} from "./wallet-spend-balance-preview";

export function WalletCheckoutButton({
  actorId,
  productId,
  buildId,
  amountLabel,
  amountMinor,
  currency,
  signedIn,
  signInHref,
  fxRates,
}: {
  actorId: string | null;
  productId: string;
  /** Optional published build evidence for single-product checkout. */
  buildId?: string;
  amountLabel: string;
  amountMinor: number;
  currency: string;
  signedIn: boolean;
  signInHref: string;
  /** Recorded pairs for the amount due. Null means the rate read failed. */
  fxRates?: readonly ExplicitFxRate[] | null;
}) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const router = useRouter();
  const field = useId();
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoQuote, setPromoQuote] = useState<ReturnType<typeof confirmedPromoQuote>>(null);
  const [done, setDone] = useState<{
    orderId: string;
    orderNumber: string;
    promo: { code: string; discountAmount: number; listAmount: number } | null;
  } | null>(null);
  const normalizedCode = promoInput.trim().toUpperCase();
  const applied =
    promoQuote && promoQuote.code === normalizedCode && promoQuote.currency === currency
      ? promoQuote
      : null;
  const dueMinor = applied?.chargedAmount ?? amountMinor;
  const dueEstimates =
    fxRates === undefined
      ? undefined
      : publicPriceEstimates({ price: dueMinor, currency }, fxRates);
  const discountEstimates =
    !applied || fxRates === undefined
      ? undefined
      : publicPriceEstimates({ price: applied.discountAmount, currency }, fxRates);
  const balance = useWalletSpendBalance(actorId ?? "", currency, dueMinor);

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
  const codePending = normalizedCode.length > 0 && !applied;

  async function onApply() {
    if (!actorId || quoting || busy || !/^[A-Z0-9]{4,16}$/u.test(normalizedCode)) return;
    setQuoting(true);
    setError("");
    setPromoQuote(null);
    try {
      const response = await fetch("/api/checkout/wallet/promo-quote", {
        ...privateApiRequest({
          method: "POST",
          json: {
            productIds: [productId],
            promoCode: normalizedCode,
            ...(buildId ? { buildId } : {}),
          },
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const quote = response.ok ? confirmedPromoQuote(body, normalizedCode) : null;
      if (!quote || quote.currency !== currency) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        return;
      }
      setPromoQuote(quote);
    } catch {
      setError(copy.checkoutFailed);
    } finally {
      setQuoting(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!actorId || !confirmed || shortfall || codePending || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/checkout/wallet", {
        ...privateApiRequest({
          method: "POST",
          json: {
            productIds: [productId],
            ...(buildId ? { buildId } : {}),
            ...(applied ? { promoCode: applied.code } : {}),
          },
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
      setDone({
        orderId: confirmedBody.orderId,
        orderNumber: confirmedBody.orderNumber,
        promo: confirmedBody.promo,
      });
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
        {dueEstimates === null ? (
          <p className="text-[11px] text-muted">{copy.checkoutDueUnavailable}</p>
        ) : dueEstimates ? (
          <ul className="space-y-0.5 text-[11px] text-muted">
            {dueEstimates.map((line) => (
              <li key={line.quote}>
                {line.kind === "quote"
                  ? copy.checkoutDueEstimate
                      .replace("{base}", line.base)
                      .replace("{quote}", formatHistoryAmount(line.amount, line.quote, locale))
                  : line.kind === "dust"
                    ? copy.checkoutDueDust
                        .replace("{base}", line.base)
                        .replace("{quote}", line.quote)
                    : line.kind === "invalid"
                      ? copy.checkoutDueInvalid
                          .replace("{base}", line.base)
                          .replace("{quote}", line.quote)
                      : copy.checkoutDueNone
                          .replace("{base}", line.base)
                          .replace("{quote}", line.quote)}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-2">
          <label className="block text-sm text-secondary" htmlFor={`${field}-promo`}>
            {copy.promoCode}
          </label>
          <Input
            id={`${field}-promo`}
            value={promoInput}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setPromoInput(event.target.value);
              setPromoQuote(null);
            }}
          />
          <p className="text-[11px] text-muted">{copy.promoHint}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={quoting || busy || !/^[A-Z0-9]{4,16}$/u.test(normalizedCode)}
              isLoading={quoting}
              onClick={onApply}
            >
              {quoting ? copy.promoApplying : copy.promoApply}
            </Button>
            {applied ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPromoInput("");
                  setPromoQuote(null);
                }}
              >
                {copy.promoClear}
              </Button>
            ) : null}
          </div>
          {applied ? (
            <p role="status" className="text-sm text-primary">
              {copy.promoApplied
                .replace("{code}", applied.code)
                .replace(
                  "{discount}",
                  formatHistoryAmount(applied.discountAmount, applied.currency, locale),
                )
                .replace(
                  "{charged}",
                  formatHistoryAmount(applied.chargedAmount, applied.currency, locale),
                )}
            </p>
          ) : null}
          {discountEstimates === null ? (
            <p className="text-[11px] text-muted">{copy.checkoutDueUnavailable}</p>
          ) : discountEstimates ? (
            <ul className="space-y-0.5 text-[11px] text-muted">
              {discountEstimates.map((line) => (
                <li key={line.quote}>
                  {line.kind === "quote"
                    ? copy.checkoutDueEstimate
                        .replace("{base}", line.base)
                        .replace("{quote}", formatHistoryAmount(line.amount, line.quote, locale))
                    : line.kind === "dust"
                      ? copy.checkoutDueDust
                          .replace("{base}", line.base)
                          .replace("{quote}", line.quote)
                      : line.kind === "invalid"
                        ? copy.checkoutDueInvalid
                            .replace("{base}", line.base)
                            .replace("{quote}", line.quote)
                        : copy.checkoutDueNone
                            .replace("{base}", line.base)
                            .replace("{quote}", line.quote)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <WalletSpendBalancePreview balance={balance} currency={currency} amountMinor={dueMinor} />
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
        disabled={!confirmed || busy || shortfall || codePending}
        isLoading={busy}
        className="min-h-11 w-full"
      >
        {busy ? copy.checkoutSubmitting : copy.checkoutSubmit}
      </Button>
    </form>
  );
}
