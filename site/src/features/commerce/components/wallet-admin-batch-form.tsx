"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import { typeBlockSpace2, typeSmSuccess, typeXlSemiboldPrimary } from "../../shell/type-shell";
import { confirmedWalletAdminBatch } from "../wallet-admin-batch-confirmation";
import { walletError } from "../wallet-i18n";

export function WalletAdminBatchForm({
  actorId,
  path,
  title,
  note,
  eligibleLabel,
  submitLabel,
  busyLabel,
  successTemplate,
  failedLabel,
}: {
  actorId: string;
  path: string;
  title: string;
  note: string;
  eligibleLabel?: string;
  submitLabel: string;
  busyLabel: string;
  successTemplate: string;
  failedLabel: string;
}) {
  const { locale } = useNexusLocale();
  const router = useRouter();
  const field = useId();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState<number | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, {
        ...privateApiRequest({
          method: "POST",
          json: {},
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const confirmed = response.ok ? confirmedWalletAdminBatch(body, actorId) : null;
      if (!confirmed) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        return;
      }
      setCount(confirmed.count);
      router.refresh();
    } catch {
      setError(failedLabel);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (count !== null) {
    return (
      <p role="status" className={typeSmSuccess}>
        {successTemplate.replace("{count}", String(count))}
      </p>
    );
  }

  return (
    <form className={panelClipSpace4P5} onSubmit={onSubmit} aria-labelledby={`${field}-heading`}>
      <div className={typeBlockSpace2}>
        <h3 id={`${field}-heading`} className={typeXlSemiboldPrimary}>
          {title}
        </h3>
        <p className="text-secondary">{note}</p>
        {eligibleLabel ? <p className="text-secondary">{eligibleLabel}</p> : null}
      </div>
      {error ? <ErrorState title={error} description={failedLabel} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? busyLabel : submitLabel}
      </Button>
    </form>
  );
}
