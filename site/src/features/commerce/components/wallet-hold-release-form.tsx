"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import { typeBlockSpace2, typeSmSuccess, typeXlSemiboldPrimary } from "../../shell/type-shell";
import { confirmedWalletHoldRelease } from "../wallet-hold-release-confirmation";
import { getWalletCopy, walletError } from "../wallet-i18n";

export function WalletHoldReleaseForm({
  actorId,
  organizationId,
  maturedCount,
}: {
  actorId: string;
  organizationId?: string;
  maturedCount: number;
}) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const router = useRouter();
  const field = useId();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [releasedCount, setReleasedCount] = useState<number | null>(null);

  if (maturedCount <= 0) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/wallet/holds/release-matured", {
        ...privateApiRequest({
          method: "POST",
          json: organizationId ? { organizationId } : {},
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const confirmed = response.ok ? confirmedWalletHoldRelease(body) : null;
      if (
        !confirmed ||
        (organizationId
          ? confirmed.organizationId !== organizationId
          : confirmed.organizationId !== null)
      ) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        return;
      }
      setReleasedCount(confirmed.releasedCount);
      router.refresh();
    } catch {
      setError(copy.heldReleaseFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (releasedCount !== null) {
    return (
      <p role="status" className={typeSmSuccess}>
        {copy.heldReleaseSuccess.replace("{count}", String(releasedCount))}
      </p>
    );
  }

  return (
    <form
      className={panelClipSpace4P5}
      onSubmit={onSubmit}
      aria-labelledby={`${field}-held-release-heading`}
    >
      <div className={typeBlockSpace2}>
        <h3 id={`${field}-held-release-heading`} className={typeXlSemiboldPrimary}>
          {organizationId ? copy.heldOrgReleaseTitle : copy.heldReleaseTitle}
        </h3>
        <p className="text-secondary">
          {(organizationId ? copy.heldOrgReleaseNote : copy.heldReleaseNote).replace(
            "{count}",
            String(maturedCount),
          )}
        </p>
      </div>
      {error ? <ErrorState title={error} /> : null}
      <Button type="submit" disabled={busy}>
        {busy ? copy.heldReleasing : copy.heldReleaseSubmit}
      </Button>
    </form>
  );
}
