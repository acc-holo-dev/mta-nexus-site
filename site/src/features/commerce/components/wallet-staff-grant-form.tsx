"use client";

import { Button, ErrorState, Input } from "@nexus/ui";
import { walletStaffGrantSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { useNexusLocale } from "../../shell/locale";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import {
  typeBlockSpace2,
  typeSmSecondary,
  typeSmSuccess,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import { parseCommercialAmount } from "../commercial-confirmation";
import { formatFinancialMinor } from "../financial-i18n";
import { getWalletCopy, walletError } from "../wallet-i18n";
import {
  type ConfirmedStaffWalletGrant,
  confirmedStaffWalletGrant,
} from "../wallet-staff-grant-confirmation";

function grantKey() {
  return `grant_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function WalletStaffGrantForm({ actorId }: { actorId: string }) {
  const { locale } = useNexusLocale();
  const copy = getWalletCopy(locale);
  const field = useId();
  const router = useRouter();
  const lock = useRef(false);
  const payloadKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("10.00");
  const [currency, setCurrency] = useState<"USD" | "EUR" | "RUB">("RUB");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConfirmedStaffWalletGrant | null>(null);

  function keyFor(fingerprint: string) {
    if (payloadKey.current?.fingerprint !== fingerprint) {
      payloadKey.current = { fingerprint, key: grantKey() };
    }
    return payloadKey.current.key;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const minor = parseCommercialAmount(amount);
    if (minor === null || minor <= 0) {
      setError(copy.grantInvalid);
      setResult(null);
      return;
    }
    const fingerprint = JSON.stringify({ username, minor, currency, reason });
    const parsed = walletStaffGrantSchema.safeParse({
      username,
      amount: minor,
      currency,
      reason,
      idempotencyKey: keyFor(fingerprint),
    });
    if (!parsed.success) {
      setError(copy.grantInvalid);
      setResult(null);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/commerce/wallet-grants", {
        ...privateApiRequest({ method: "POST", json: parsed.data }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      const confirmed = response.ok ? confirmedStaffWalletGrant(body, actorId) : null;
      if (!confirmed) {
        const code = body && typeof body === "object" ? (body as { code?: unknown }).code : null;
        setError(walletError(locale, code));
        setResult(null);
        return;
      }
      setResult(confirmed);
      payloadKey.current = null;
      router.refresh();
    } catch {
      setError(copy.grantFailed);
      setResult(null);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form className={panelClipSpace4P5} onSubmit={onSubmit} aria-labelledby={`${field}-heading`}>
      <div className={typeBlockSpace2}>
        <h2 id={`${field}-heading`} className={typeXlSemiboldPrimary}>
          {copy.grantTitle}
        </h2>
        <p className={typeSmSecondary}>{copy.grantNote}</p>
      </div>
      <Input
        label={copy.grantUsername}
        name="username"
        autoComplete="off"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        required
        minLength={3}
        maxLength={32}
      />
      <Input
        label={copy.grantAmount}
        name="amount"
        inputMode="decimal"
        hint={copy.grantAmountHint}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        required
      />
      <label className="block space-y-1 text-sm text-secondary">
        <span>{copy.currency}</span>
        <select
          className="w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary"
          name="currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value as "USD" | "EUR" | "RUB")}
        >
          <option value="RUB">RUB</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <Input
        label={copy.grantReason}
        name="reason"
        hint={copy.grantReasonHint}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        required
        minLength={8}
        maxLength={280}
      />
      {error ? <ErrorState title={error} description={copy.grantFailed} /> : null}
      {result ? (
        <p role="status" className={typeSmSuccess}>
          {copy.grantSuccess
            .replace("{username}", result.username)
            .replace("{amount}", formatFinancialMinor(result.amount, result.currency, locale))
            .replace(
              "{available}",
              formatFinancialMinor(result.available, result.currency, locale),
            )}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? copy.grantSubmitting : copy.grantSubmit}
      </Button>
    </form>
  );
}
