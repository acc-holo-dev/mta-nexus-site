"use client";

import {
  canTransitionResource,
  type ProductStatus,
  type ResourceLifecycleAction,
} from "@nexus/domain";
import { Button } from "@nexus/ui";
import { resourceLifecycleSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { getResourceCommerceCopy, resourceCommerceError } from "../lib/resource-commerce-i18n";
import { useNexusLocale } from "./locale-context";

const controlClass =
  "h-10 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export function ResourceLifecycleControls({
  product,
}: {
  product: { id: string; status: ProductStatus; updatedAt: string };
}) {
  const { locale } = useNexusLocale();
  const copy = getResourceCommerceCopy(locale);
  const router = useRouter();
  const fieldId = useId();
  const lock = useRef(false);
  const actions = (["archive", "restore", "submit"] as const).filter((action) =>
    canTransitionResource(product.status, action),
  );
  const [action, setAction] = useState<ResourceLifecycleAction>(actions[0] ?? "archive");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const labels = { archive: copy.archive, restore: copy.restore, submit: copy.submit };
  const notes = { archive: copy.archiveNote, restore: copy.restoreNote, submit: copy.submitNote };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || saved) return;
    const parsed = resourceLifecycleSchema.safeParse({
      action,
      reason,
      expectedUpdatedAt: product.updatedAt,
    });
    if (!parsed.success || !confirmed) {
      setError(copy.errors.RESOURCE_LIFECYCLE_INVALID);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/products/${product.id}/lifecycle`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const body = await response.json().catch(() => null);
      const target =
        action === "archive" ? "archived" : action === "restore" ? "draft" : "pending_review";
      if (
        !response.ok ||
        body?.product?.id !== product.id ||
        body.product.status !== target ||
        typeof body.product.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(body.product.updatedAt)) ||
        Date.parse(body.product.updatedAt) <= Date.parse(product.updatedAt)
      ) {
        setError(resourceCommerceError(locale, body?.code));
        if (response.status === 409) router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="nexus-panel space-y-4 p-5" aria-labelledby={`${fieldId}-heading`}>
      <h2 id={`${fieldId}-heading`} className="text-xl font-semibold text-primary">
        {copy.lifecycle}
      </h2>
      {actions.length === 0 ? (
        <p className="text-sm text-warning">{copy.blocked}</p>
      ) : (
        <form onSubmit={submit} aria-busy={busy} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-action`} className={nativeLabelClass}>
              {copy.lifecycle}
            </label>
            <select
              id={`${fieldId}-action`}
              value={action}
              disabled={busy || saved}
              onChange={(event) => {
                setAction(event.target.value as ResourceLifecycleAction);
                setConfirmed(false);
              }}
              className={controlClass}
            >
              {actions.map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </div>
          <p id={`${fieldId}-note`} className="text-sm text-secondary">
            {notes[action]}
          </p>
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-reason`} className={nativeLabelClass}>
              {copy.reason}
            </label>
            <textarea
              id={`${fieldId}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              disabled={busy || saved}
              className={textareaClass}
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-secondary">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || saved}
              onChange={(event) => setConfirmed(event.target.checked)}
              required
              aria-describedby={`${fieldId}-note`}
            />
            <span>{copy.confirm}</span>
          </label>
          <Button
            type="submit"
            isLoading={busy}
            disabled={saved || !confirmed}
            className="min-h-11"
          >
            {busy ? copy.working : labels[action]}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.updated}
        </p>
      )}
    </section>
  );
}
