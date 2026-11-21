"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { typeSmSecondary, typeSmSuccess } from "../../shell/type-shell";
import { getWalletCopy, walletError } from "../wallet-i18n";
import { confirmedWalletOrderRefund } from "../wallet-order-refund-confirmation";

export function WalletOrderRefundForm({ actorId, orderId }: { actorId: string; orderId: string }) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const router = useRouter();
  const field = useId();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"fresh" | "replay" | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/commerce/wallet-orders/${orderId}/refund`, {
        ...privateApiRequest({
          method: "POST",
          json: {},
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const confirmed = response.ok ? confirmedWalletOrderRefund(body, { orderId }) : null;
      if (!confirmed) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        return;
      }
      setDone(confirmed.alreadyRefunded ? "replay" : "fresh");
      router.refresh();
    } catch {
      setError(copy.walletRefundFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className={typeSmSuccess}>
        {done === "replay" ? copy.walletRefundAlready : copy.walletRefundSuccess}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby={`${field}-refund-heading`}>
      <h3 id={`${field}-refund-heading`} className="text-base font-semibold text-primary">
        {copy.walletRefund}
      </h3>
      <p className={typeSmSecondary} role="note">
        {copy.walletRefundNote}
      </p>
      {error ? <ErrorState title={error} description={copy.walletRefundFailed} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? copy.walletRefunding : copy.walletRefundSubmit}
      </Button>
    </form>
  );
}
