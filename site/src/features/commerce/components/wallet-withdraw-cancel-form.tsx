"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { typeSmSuccess } from "../../shell/type-shell";
import { getWalletCopy, walletError } from "../wallet-i18n";
import { confirmedWalletWithdrawalCancel } from "../wallet-withdraw-cancel-confirmation";

export function WalletWithdrawCancelForm({
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/wallet/withdrawals/${intentId}/cancel`, {
        ...privateApiRequest({
          method: "POST",
          json: organizationId ? { organizationId } : {},
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const confirmed = response.ok
        ? confirmedWalletWithdrawalCancel(body, {
            intentId,
            ...(organizationId ? { organizationId } : {}),
          })
        : null;
      if (!confirmed) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        return;
      }
      setCancelled(true);
      router.refresh();
    } catch {
      setError(copy.withdrawCancelFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (cancelled) {
    return (
      <p role="status" className={typeSmSuccess}>
        {copy.withdrawCancelSuccess}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby={`${field}-cancel-heading`}>
      <h4 id={`${field}-cancel-heading`} className="sr-only">
        {copy.withdrawCancel}
      </h4>
      {error ? <ErrorState title={error} description={copy.withdrawCancelFailed} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? copy.withdrawCancelling : copy.withdrawCancel}
      </Button>
    </form>
  );
}
