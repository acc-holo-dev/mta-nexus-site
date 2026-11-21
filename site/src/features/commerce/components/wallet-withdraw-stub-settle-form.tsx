"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { typeFlexWrapGap4Sm, typeSmSecondary, typeSmSuccess } from "../../shell/type-shell";
import { getWalletCopy, walletError } from "../wallet-i18n";
import { confirmedWalletWithdrawalStubSettle } from "../wallet-withdraw-stub-settle-confirmation";

export function WalletWithdrawStubSettleForm({
  actorId,
  intentId,
  organizationId,
}: {
  actorId: string;
  intentId: string;
  organizationId?: string;
}) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const router = useRouter();
  const field = useId();
  const lock = useRef(false);
  const [busy, setBusy] = useState<"succeeded" | "failed" | null>(null);
  const [error, setError] = useState("");
  const [resultKind, setResultKind] = useState<"payout_succeeded" | "payout_failed" | null>(null);

  async function submit(outcome: "succeeded" | "failed") {
    if (lock.current) return;
    lock.current = true;
    setBusy(outcome);
    setError("");
    try {
      const response = await fetch(`/api/wallet/withdrawals/${intentId}/stub-settle`, {
        ...privateApiRequest({
          method: "POST",
          json: {
            outcome,
            ...(organizationId ? { organizationId } : {}),
          },
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const confirmed = response.ok
        ? confirmedWalletWithdrawalStubSettle(body, {
            intentId,
            outcome,
            ...(organizationId ? { organizationId } : {}),
          })
        : null;
      if (!confirmed) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        return;
      }
      setResultKind(confirmed.kind);
      router.refresh();
    } catch {
      setError(copy.withdrawStubSettleFailed);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  if (resultKind) {
    return (
      <p role="status" className={typeSmSuccess}>
        {resultKind === "payout_succeeded"
          ? copy.withdrawStubSettleSuccessPaid
          : copy.withdrawStubSettleSuccessFailed}
      </p>
    );
  }

  return (
    <form
      aria-labelledby={`${field}-stub-settle-heading`}
      onSubmit={(event) => event.preventDefault()}
    >
      <h4 id={`${field}-stub-settle-heading`} className="sr-only">
        {copy.withdrawStubSettle}
      </h4>
      <p className={typeSmSecondary} role="note">
        {copy.withdrawStubSettleNote}
      </p>
      {error ? <ErrorState title={error} description={copy.withdrawStubSettleFailed} /> : null}
      <div className={typeFlexWrapGap4Sm}>
        <Button type="button" disabled={busy !== null} onClick={() => void submit("succeeded")}>
          {busy === "succeeded" ? copy.withdrawStubSettling : copy.withdrawStubSettlePaid}
        </Button>
        <Button type="button" disabled={busy !== null} onClick={() => void submit("failed")}>
          {busy === "failed" ? copy.withdrawStubSettling : copy.withdrawStubSettleFailedOutcome}
        </Button>
      </div>
    </form>
  );
}
