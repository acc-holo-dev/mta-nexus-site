"use client";
import type { CommercialPlanTerms, SubscriptionCommand } from "@nexus/domain";
import { subscriptionCommandSchema } from "@nexus/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedSubscriptionReceipt } from "../lib/subscription-confirmation";
import { subscriptionError, subscriptionsCopy } from "../lib/subscriptions-i18n";
import { subscriptionAccountHref, subscriptionReceiptHref } from "../lib/subscriptions-query";
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
    request = useRef<SubscriptionCommand | null>(null);
  const [organizationId, setOrganization] = useState(
      props.action === "activate" ? (props.scopes[0]?.id ?? "") : (props.organizationId ?? ""),
    ),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
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
    request.current = parsed.data;
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    try {
      const response = await fetch(
          "/api/subscriptions/account",
          privateApiRequest({ method: "POST", json: parsed.data }),
        ),
        body = await response.json().catch(() => null);
      const receiptId = response.ok
        ? confirmedSubscriptionReceipt(body, parsed.data, props.actorId, {
            terms: props.terms,
            planId: props.planId,
            planRevision: props.planRevision,
            ...(props.action === "cancel"
              ? { startedAt: props.startedAt, expiresAt: props.expiresAt }
              : {}),
          })
        : null;
      if (!receiptId) {
        setError(subscriptionError(locale, body?.code));
        return;
      }
      router.push(subscriptionReceiptHref(receiptId, parsed.data.organizationId));
      router.refresh();
    } catch {
      setError(c.retry);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5">
      <p role="note" className="text-sm text-secondary">
        {props.action === "activate" ? c.notice : c.cancelNote}
      </p>
      <fieldset disabled={busy || frozen}>
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
          <label htmlFor={`${field}-confirm`} className="flex items-center gap-3">
            <input
              id={`${field}-confirm`}
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {c.confirmCancel}
          </label>
        ) : (
          <p>{c.personal}</p>
        )}
      </fieldset>
      {frozen && (
        <p role="note" className="text-sm text-secondary">
          {c.frozen}
        </p>
      )}
      {error && (
        <p role="alert" className="text-warning">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        type="submit"
        className="rounded bg-accent px-4 py-2 text-background disabled:opacity-50"
      >
        {busy ? c.busy : props.action === "activate" ? c.activate : c.cancel}
      </button>
      <Link
        href={`${subscriptionAccountHref(props.action === "cancel" ? props.organizationId : props.scope === "organization" ? organizationId || undefined : undefined).replace("/workspace/subscriptions", "/workspace/subscriptions/history")}`}
        className="ml-4 text-accent underline"
      >
        {c.history}
      </Link>
    </form>
  );
}
