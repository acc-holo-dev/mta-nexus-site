"use client";
import type { OrderCancellationCommand } from "@nexus/domain";
import { Button, ErrorState, fieldClassBlock } from "@nexus/ui";
import { orderCancellationCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { confirmedOrderCancellation } from "../lib/commercial-confirmation";
import { commercialError, getCommercialCopy } from "../lib/commercial-i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { ActionConfirmCheckbox } from "./action-confirm-checkbox";
import { useNexusLocale } from "./locale-context";

export function OrderCancellationForm({
  actorId,
  orderId,
  expectedUpdatedAt,
  canCancel,
}: {
  actorId: string;
  orderId: string;
  expectedUpdatedAt: string;
  canCancel: boolean;
}) {
  const { locale } = useNexusLocale(),
    copy = getCommercialCopy(locale),
    field = useId(),
    router = useRouter();
  const lock = useRef(false),
    pending = useRef<OrderCancellationCommand | null>(null),
    epoch = useRef(0),
    controller = useRef<AbortController | null>(null);
  const scope = `${actorId}:${orderId}`;
  const current = useRef(scope);
  if (current.current !== scope) {
    current.current = scope;
    epoch.current++;
  }
  const key = `nexus:order-cancel:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(orderId)}`;
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState("");
  // scope includes both the actor and order; a new revision must not replace a pending request.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is the recovery identity.
  useEffect(() => {
    let active = true;
    epoch.current++;
    controller.current?.abort();
    lock.current = false;
    pending.current = null;
    setReady("");
    setReason("");
    setConfirmed(false);
    setBusy(false);
    setRetry(false);
    setSaved(false);
    setError("");
    async function restore() {
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(key);
        if (raw) {
          if (raw.length > 10000) throw new Error("storage");
          const item = JSON.parse(raw),
            command = orderCancellationCommandSchema.safeParse(item?.command);
          if (item?.actorId !== actorId || item?.orderId !== orderId || !command.success)
            throw new Error("storage");
          if (active) {
            pending.current = command.data;
            setReason(command.data.reason);
            setConfirmed(true);
            setRetry(true);
          }
        }
        if (active) setReady(scope);
      } catch {
        if (active)
          setError(
            locale === "ru"
              ? "Не удалось проверить аккаунт или восстановить запрос. Обновите страницу и войдите в исходный аккаунт."
              : "Could not verify the account or restore the request. Refresh and sign in to the original account.",
          );
      }
    }
    void restore();
    return () => {
      active = false;
      epoch.current++;
      controller.current?.abort();
    };
  }, [scope, key]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (ready !== scope || current.current !== scope || lock.current || saved) return;
    const version = epoch.current,
      firstAttempt = !pending.current;
    if (firstAttempt && !canCancel) return;
    const parsed = orderCancellationCommandSchema.safeParse(
      pending.current ?? {
        requestId: crypto.randomUUID(),
        expectedUpdatedAt,
        reason: reason.trim(),
      },
    );
    if (!confirmed || !parsed.success) {
      setError(commercialError(locale, "ORDER_OPERATION_INVALID"));
      return;
    }
    if (firstAttempt) {
      try {
        if (sessionStorage.getItem(key) !== null) throw new Error("pending");
        const raw = JSON.stringify({ actorId, orderId, command: parsed.data });
        sessionStorage.setItem(key, raw);
        if (sessionStorage.getItem(key) !== raw) throw new Error("storage");
      } catch {
        setError(
          locale === "ru"
            ? "Не удалось сохранить данные восстановления. Запрос не отправлен."
            : "Could not save recovery data. The request was not sent.",
        );
        return;
      }
      pending.current = parsed.data;
    }
    lock.current = true;
    setBusy(true);
    setRetry(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
        ...privateApiRequest({ method: "POST", json: parsed.data, signal: abort.signal }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const value = await response.json().catch(() => null);
      if (version !== epoch.current || abort.signal.aborted) return;
      if (
        !response.ok ||
        value?.actorId !== actorId ||
        !confirmedOrderCancellation(
          value,
          orderId,
          parsed.data.requestId,
          parsed.data.expectedUpdatedAt,
        )
      ) {
        if (
          firstAttempt &&
          [400, 401, 403, 404, 409, 413, 415, 422, 428, 429].includes(response.status)
        ) {
          try {
            sessionStorage.removeItem(key);
            if (sessionStorage.getItem(key) !== null) throw new Error("storage");
            pending.current = null;
            setRetry(false);
          } catch {
            /* Preserve the recoverable request. */
          }
        }
        if (response.status === 401 || value?.code === "ACTOR_CHANGED") setReady("");
        setError(commercialError(locale, value?.code));
        return;
      }
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Exact replay remains safe. */
      }
      setSaved(true);
      setRetry(false);
      router.refresh();
    } catch {
      if (version === epoch.current && !abort.signal.aborted)
        setError(commercialError(locale, null));
    } finally {
      if (version === epoch.current) {
        lock.current = false;
        setBusy(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  }
  if (ready !== scope && !canCancel)
    return error ? <ErrorState title={error} description={copy.formErrorHint} /> : null;
  if (ready === scope && !canCancel && !pending.current && !saved) return null;
  return (
    <form onSubmit={submit} className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-5">
      <h2 className="text-xl font-semibold text-primary">{copy.cancel}</h2>
      {ready === scope && retry ? (
        <ErrorState
          id="order-cancellation-unconfirmed"
          title={
            locale === "ru"
              ? "Результат предыдущего запроса не подтверждён. Повторите только сохранённый запрос."
              : "The previous request was not confirmed. Retry only the saved request."
          }
        />
      ) : null}
      <fieldset disabled={busy || retry || saved || ready !== scope} className="space-y-4">
        <label htmlFor={`${field}-reason`} className="block space-y-2">
          <span className="text-sm">{copy.reason}</span>
          <textarea
            id={`${field}-reason`}
            value={ready === scope ? reason : ""}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={1000}
            rows={2}
            required
            className={fieldClassBlock}
          />
        </label>
        <ActionConfirmCheckbox
          id={`${field}-confirm`}
          checked={ready === scope && confirmed}
          onCheckedChange={setConfirmed}
          required
        >
          {copy.confirmCancel}
        </ActionConfirmCheckbox>
      </fieldset>
      {error ? <ErrorState title={error} description={copy.formErrorHint} /> : null}
      {ready === scope && saved ? (
        <p role="status" className="text-sm text-success">
          {copy.cancelled}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || saved || !confirmed || ready !== scope}
        isLoading={busy}
        className="min-h-11"
      >
        {busy ? copy.cancelling : retry ? copy.retry : copy.cancel}
      </Button>
    </form>
  );
}
