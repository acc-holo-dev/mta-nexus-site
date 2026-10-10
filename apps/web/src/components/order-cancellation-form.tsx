"use client";
import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderCancellationCommand } from "@nexus/domain";
import { orderCancellationCommandSchema } from "@nexus/validation";
import { privateApiRequest } from "../lib/private-api-request";
import { commercialError, getCommercialCopy } from "../lib/commercial-i18n";
import { confirmedOrderCancellation } from "../lib/commercial-confirmation";
import { useNexusLocale } from "./locale-context";

export function OrderCancellationForm({
  orderId,
  expectedUpdatedAt,
}: {
  orderId: string;
  expectedUpdatedAt: string;
}) {
  const { locale } = useNexusLocale(),
    copy = getCommercialCopy(locale),
    field = useId(),
    router = useRouter();
  const lock = useRef(false),
    pending = useRef<OrderCancellationCommand | null>(null);
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || saved) return;
    const command = pending.current ?? {
      requestId: crypto.randomUUID(),
      expectedUpdatedAt,
      reason: reason.trim(),
    };
    if (!confirmed || !orderCancellationCommandSchema.safeParse(command).success) {
      setError(commercialError(locale, "ORDER_OPERATION_INVALID"));
      return;
    }
    pending.current = command;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/cancel`,
        privateApiRequest({ method: "POST", json: command }),
      );
      const value: unknown = await response.json();
      if (!response.ok) {
        const code = value && typeof value === "object" && "code" in value ? value.code : null;
        setError(commercialError(locale, code));
        // A server error can follow a committed transaction: retain the exact receipt key.
        if (response.status >= 500) {
          setRetry(true);
          return;
        }
        pending.current = null;
        setRetry(false);
        if (response.status === 409) router.refresh();
        return;
      }
      if (!confirmedOrderCancellation(value, orderId, command.requestId)) {
        setError(commercialError(locale, null));
        setRetry(true);
        return;
      }
      setSaved(true);
      setRetry(false);
      router.refresh();
    } catch {
      setError(commercialError(locale, null));
      setRetry(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5">
      <h2 className="text-xl font-semibold text-primary">{copy.cancel}</h2>
      <fieldset disabled={busy || retry || saved} className="space-y-4">
        <label htmlFor={`${field}-reason`} className="block space-y-2">
          <span className="text-sm">{copy.reason}</span>
          <textarea
            id={`${field}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={1000}
            rows={2}
            required
            className="nexus-input w-full"
          />
        </label>
        <label htmlFor={`${field}-confirm`} className="flex items-start gap-3 text-sm">
          <input
            id={`${field}-confirm`}
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            required
            className="mt-1"
          />
          <span>{copy.confirmCancel}</span>
        </label>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {copy.cancelled}
        </p>
      ) : null}
      <button type="submit" disabled={busy || saved || !confirmed} className="btn-primary">
        {busy ? copy.cancelling : retry ? copy.retry : copy.cancel}
      </button>
    </form>
  );
}
