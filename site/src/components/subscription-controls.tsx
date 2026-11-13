"use client";
import type { CommercialPlanTerms, SubscriptionCommand } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { commercialPlanTermsSchema, subscriptionCommandSchema } from "@nexus/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { commercialTerms } from "../lib/commercial-confirmation";
import { privateApiRequest } from "../lib/private-api-request";
import {
  confirmedSubscriptionReceipt,
  expectedSubscriptionReceiptId,
} from "../lib/subscription-confirmation";
import { subscriptionError, subscriptionsCopy } from "../lib/subscriptions-i18n";
import { subscriptionAccountHref, subscriptionReceiptHref } from "../lib/subscriptions-query";
import { ActionConfirmCheckbox, actionConfirmCheckboxFocusClass } from "./action-confirm-checkbox";
import { useNexusLocale } from "./locale-context";

type Props = {
  actorId: string;
  planId: string;
  planRevision: number;
  terms: CommercialPlanTerms;
} & (
  | { action: "activate"; scope: "user" | "organization"; scopes: { id: string; name: string }[] }
  | {
      action: "cancel";
      subscriptionId: string;
      organizationId?: string;
      startedAt: string;
      expiresAt: string;
    }
);
export function SubscriptionControls(props: Props) {
  const { locale } = useNexusLocale(),
    c = subscriptionsCopy(locale),
    router = useRouter(),
    field = useId(),
    lock = useRef(false),
    request = useRef<SubscriptionCommand | null>(null),
    snapshot = useRef<{
      terms: CommercialPlanTerms;
      planId: string;
      planRevision: number;
      startedAt?: string;
      expiresAt?: string;
    } | null>(null),
    epoch = useRef(0),
    controller = useRef<AbortController | null>(null);
  const scope = `${props.actorId}:${props.action}:${props.action === "activate" ? `${props.scope}:${props.planId}` : `${props.organizationId ?? "user"}:${props.subscriptionId}`}`;
  const priorScope = useRef(scope);
  if (priorScope.current !== scope) {
    priorScope.current = scope;
    epoch.current += 1;
  }
  const storageKey = `nexus:subscription-intent:v1:${encodeURIComponent(props.actorId)}`;
  const [ready, setReady] = useState("");
  const [organizationId, setOrganization] = useState(
      props.action === "activate" ? (props.scopes[0]?.id ?? "") : (props.organizationId ?? ""),
    ),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [error, setError] = useState("");
  // scope encodes actor, action, plan and subject; changing locale must not interrupt an operation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is the stable identity for this restoration.
  useEffect(() => {
    let active = true;
    epoch.current += 1;
    controller.current?.abort();
    request.current = null;
    snapshot.current = null;
    lock.current = false;
    setReady("");
    setFrozen(false);
    setBusy(false);
    setError("");
    setConfirmed(false);
    setOrganization(
      props.action === "activate" ? (props.scopes[0]?.id ?? "") : (props.organizationId ?? ""),
    );
    async function restore() {
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== props.actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          if (raw.length > 20000) throw new Error("storage");
          const saved = JSON.parse(raw);
          const command = subscriptionCommandSchema.safeParse(saved.command);
          const terms = commercialPlanTermsSchema.safeParse(saved.snapshot?.terms);
          if (
            saved.actorId !== props.actorId ||
            saved.scope !== scope ||
            !command.success ||
            !terms.success ||
            saved.subjectId !== (command.data.organizationId ?? props.actorId) ||
            saved.snapshot?.planId !== props.planId ||
            !Number.isSafeInteger(saved.snapshot?.planRevision) ||
            command.data.action !== props.action ||
            (command.data.action === "activate" &&
              (command.data.planId !== props.planId ||
                command.data.expectedRevision !== saved.snapshot.planRevision)) ||
            (command.data.action === "cancel" &&
              (props.action !== "cancel" ||
                command.data.subscriptionId !== props.subscriptionId ||
                command.data.organizationId !== props.organizationId ||
                typeof saved.snapshot.startedAt !== "string" ||
                typeof saved.snapshot.expiresAt !== "string"))
          )
            throw new Error("storage");
          if (active) {
            request.current = command.data;
            snapshot.current = { ...saved.snapshot, terms: terms.data };
            setOrganization(command.data.organizationId ?? "");
            setConfirmed(true);
            setFrozen(true);
          }
        }
        if (active) setReady(scope);
      } catch {
        if (active)
          setError(
            locale === "ru"
              ? "Не удалось проверить сессию или восстановить запрос. Откройте историю подписки и войдите в исходный аккаунт."
              : "Could not verify the session or restore the request. Check subscription history and sign in to the original account.",
          );
      }
    }
    void restore();
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [scope, storageKey]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || ready !== scope) return;
    const operationEpoch = epoch.current;
    const firstAttempt = !request.current;
    if (
      (props.action === "cancel" && !confirmed) ||
      (props.action === "activate" && props.scope === "organization" && !organizationId)
    ) {
      setError(c.invalid);
      return;
    }
    const parsed = subscriptionCommandSchema.safeParse(
      request.current ?? {
        requestId: crypto.randomUUID(),
        action: props.action,
        ...(props.action === "activate"
          ? {
              planId: props.planId,
              expectedRevision: props.planRevision,
              ...(props.scope === "organization" ? { organizationId } : {}),
            }
          : {
              subscriptionId: props.subscriptionId,
              ...(props.organizationId ? { organizationId: props.organizationId } : {}),
            }),
      },
    );
    if (!parsed.success) {
      setError(c.invalid);
      return;
    }
    if (firstAttempt) {
      const expected = {
        terms: commercialTerms(props.terms),
        planId: props.planId,
        planRevision: props.planRevision,
        ...(props.action === "cancel"
          ? { startedAt: props.startedAt, expiresAt: props.expiresAt }
          : {}),
      };
      try {
        const raw = JSON.stringify({
          actorId: props.actorId,
          subjectId: parsed.data.organizationId ?? props.actorId,
          scope,
          command: parsed.data,
          snapshot: expected,
        });
        if (sessionStorage.getItem(storageKey) !== null) throw new Error("pending");
        sessionStorage.setItem(storageKey, raw);
        if (sessionStorage.getItem(storageKey) !== raw) throw new Error("storage");
      } catch {
        setError(
          locale === "ru"
            ? "Не удалось сохранить данные восстановления. Запрос не отправлен."
            : "Could not save recovery data. The request was not submitted.",
        );
        return;
      }
      request.current = parsed.data;
      snapshot.current = expected;
      window.dispatchEvent(new Event("nexus-subscription-intent"));
    }
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const receiptIdExpected = await expectedSubscriptionReceiptId(
        props.actorId,
        parsed.data.requestId,
      );
      if (operationEpoch !== epoch.current || abort.signal.aborted) return;
      const response = await fetch("/api/subscriptions/account", {
          ...privateApiRequest({ method: "POST", json: parsed.data, signal: abort.signal }),
          headers: { "Content-Type": "application/json", "x-nexus-actor-id": props.actorId },
        }),
        body = await response.json().catch(() => null);
      if (operationEpoch !== epoch.current || abort.signal.aborted) return;
      const receiptId =
        response.ok && snapshot.current
          ? confirmedSubscriptionReceipt(body, parsed.data, props.actorId, {
              ...snapshot.current,
              receiptId: receiptIdExpected,
            })
          : null;
      if (!receiptId) {
        if (
          firstAttempt &&
          [400, 401, 403, 404, 409, 413, 415, 422, 428, 429].includes(response.status)
        ) {
          try {
            sessionStorage.removeItem(storageKey);
            if (sessionStorage.getItem(storageKey) !== null) throw new Error("storage");
            request.current = null;
            snapshot.current = null;
            setFrozen(false);
            window.dispatchEvent(new Event("nexus-subscription-intent"));
          } catch {
            /* Keep the original intent if storage is unavailable. */
          }
        }
        if (response.status === 401 || body?.code === "ACTOR_CHANGED") setReady("");
        setError(subscriptionError(locale, body?.code));
        return;
      }
      try {
        sessionStorage.removeItem(storageKey);
        window.dispatchEvent(new Event("nexus-subscription-intent"));
      } catch {
        /* Exact replay stays safe. */
      }
      router.push(subscriptionReceiptHref(receiptId, parsed.data.organizationId));
      router.refresh();
    } catch {
      if (operationEpoch === epoch.current && !abort.signal.aborted) setError(c.retry);
    } finally {
      if (operationEpoch === epoch.current) {
        lock.current = false;
        if (!abort.signal.aborted) setBusy(false);
      }
      if (controller.current === abort) controller.current = null;
    }
  }
  return (
    <form onSubmit={submit} className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-5">
      <p role="note" className="text-sm text-secondary">
        {props.action === "activate" ? c.notice : c.cancelNote}
      </p>
      <fieldset hidden={ready !== scope} disabled={busy || frozen}>
        {props.action === "activate" && props.scope === "organization" ? (
          <label htmlFor={`${field}-org`}>
            <span className="block">{c.organization}</span>
            <select
              required
              id={`${field}-org`}
              value={organizationId}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full rounded border border-base bg-surface p-2"
            >
              <option value="">{c.organization}</option>
              {props.scopes.map((scope) => (
                <option key={scope.id} value={scope.id}>
                  {scope.name}
                </option>
              ))}
            </select>
          </label>
        ) : props.action === "cancel" ? (
          <ActionConfirmCheckbox
            id={`${field}-confirm`}
            checked={confirmed}
            onCheckedChange={setConfirmed}
            required
            labelClassName="flex items-center gap-3"
            checkboxClassName={actionConfirmCheckboxFocusClass}
          >
            {c.confirmCancel}
          </ActionConfirmCheckbox>
        ) : (
          <p>{c.personal}</p>
        )}
      </fieldset>
      {frozen && ready === scope && (
        <p role="note" className="text-sm text-secondary">
          {c.frozen}
        </p>
      )}
      {error ? <ErrorState title={error} description={c.formErrorHint} /> : null}
      <Button
        type="submit"
        disabled={busy || ready !== scope}
        isLoading={busy}
        className="min-h-11"
      >
        {busy ? c.busy : props.action === "activate" ? c.activate : c.cancel}
      </Button>
      <Link
        href={`${subscriptionAccountHref(props.action === "cancel" ? props.organizationId : props.scope === "organization" ? organizationId || undefined : undefined).replace("/workspace/subscriptions", "/workspace/subscriptions/history")}`}
        className="ml-4 inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {c.history}
      </Link>
    </form>
  );
}
