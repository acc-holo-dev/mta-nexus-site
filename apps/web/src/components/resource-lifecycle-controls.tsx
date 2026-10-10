"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  canTransitionResource,
  type ProductStatus,
  type ResourceLifecycleAction,
} from "@nexus/domain";
import { resourceLifecycleSchema } from "@nexus/validation";
import { useNexusLocale } from "./locale-context";
import { privateApiRequest } from "../lib/private-api-request";
import { getResourceCommerceCopy, resourceCommerceError } from "../lib/resource-commerce-i18n";

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
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor={`${fieldId}-action`} className="block text-sm text-secondary">
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
            className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
          >
            {actions.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
          <p id={`${fieldId}-note`} className="text-sm text-secondary">
            {notes[action]}
          </p>
          <label htmlFor={`${fieldId}-reason`} className="block text-sm text-secondary">
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
            className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
          />
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
          <button
            type="submit"
            disabled={busy || saved || !confirmed}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? copy.working : labels[action]}
          </button>
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
