"use client";

import type { ExplicitFxRate } from "@nexus/domain";
import { useEffect, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { formatHistoryAmount } from "../commerce-history-format";
import { confirmedWalletBalance } from "../wallet-balance-confirmation";
import { getWalletCopy } from "../wallet-i18n";
import { RecordedRateEstimate } from "./recorded-rate-estimate";

export type WalletSpendBalanceState =
  | { status: "loading" }
  | { status: "ready"; available: number; enough: boolean }
  | { status: "unavailable" };

export function useWalletSpendBalance(
  actorId: string,
  currency: string,
  amountMinor: number,
): WalletSpendBalanceState {
  const [state, setState] = useState<WalletSpendBalanceState>({ status: "loading" });

  useEffect(() => {
    if (!actorId || amountMinor < 0) {
      setState({ status: "unavailable" });
      return;
    }
    let active = true;
    const controller = new AbortController();
    setState({ status: "loading" });
    const query = new URLSearchParams({ currency });
    fetch(`/api/wallet/balance?${query.toString()}`, {
      ...privateApiRequest({ method: "GET", signal: controller.signal }),
      headers: { "x-nexus-actor-id": actorId },
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!active) return;
        const confirmed = response.ok ? confirmedWalletBalance(body) : null;
        if (!confirmed || confirmed.currency !== currency) {
          setState({ status: "unavailable" });
          return;
        }
        setState({
          status: "ready",
          available: confirmed.available,
          enough: confirmed.available >= amountMinor,
        });
      })
      .catch(() => {
        if (active) setState({ status: "unavailable" });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [actorId, currency, amountMinor]);

  return state;
}

export function WalletSpendBalancePreview({
  balance,
  currency,
  amountMinor,
  rates,
}: {
  balance: WalletSpendBalanceState;
  currency: string;
  amountMinor: number;
  /** Recorded pairs already loaded by the parent. Undefined skips the quote. */
  rates?: readonly ExplicitFxRate[] | null;
}) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const walletHref = `/workspace/wallet?currency=${encodeURIComponent(currency)}`;

  if (balance.status === "loading") {
    return (
      <p role="status" className="text-[11px] text-muted">
        {copy.spendBalanceLoading}
      </p>
    );
  }

  if (balance.status === "unavailable") {
    return (
      <p role="status" className="text-[11px] text-muted">
        {copy.spendBalanceUnavailable}
      </p>
    );
  }

  const availableLabel = formatHistoryAmount(balance.available, currency, locale);
  const dueLabel = formatHistoryAmount(amountMinor, currency, locale);
  const quoteLocale = locale === "ru" ? "ru" : "en";

  return (
    <div
      className="space-y-1 text-[11px]"
      data-wallet-spend-balance={balance.enough ? "ok" : "short"}
    >
      <p className="text-secondary">
        {copy.available}: <span className="font-numeric text-primary">{availableLabel}</span>
      </p>
      {rates === undefined ? null : (
        <RecordedRateEstimate
          amount={balance.available}
          currency={currency}
          locale={quoteLocale}
          rates={rates}
        />
      )}
      <p className="text-secondary">
        {copy.spendDue}: <span className="font-numeric text-primary">{dueLabel}</span>
      </p>
      {rates === undefined ? null : (
        <RecordedRateEstimate
          amount={amountMinor}
          currency={currency}
          locale={quoteLocale}
          rates={rates}
        />
      )}
      {!balance.enough ? (
        <div className="space-y-1" role="status">
          <p className="text-warning">{copy.spendInsufficient}</p>
          <a
            href={walletHref}
            className="inline-flex min-h-11 items-center text-xs font-semibold text-accent underline-offset-2 hover:underline"
          >
            {copy.spendTopUpLink}
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function walletSpendSubmitBlocked(balance: WalletSpendBalanceState): boolean {
  return balance.status === "ready" && !balance.enough;
}
