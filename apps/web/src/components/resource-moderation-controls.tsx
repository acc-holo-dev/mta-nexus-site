"use client";
import { type FormEvent, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resourceModerationCommandSchema } from "@nexus/validation";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedResourceModeration } from "../lib/resource-release-control-confirmation";
import {
  getResourceReleaseControlCopy,
  resourceReleaseControlError,
} from "../lib/resource-release-control-i18n";
import { useNexusLocale } from "./locale-context";
export function ResourceModerationControls({
  product,
}: {
  product: { id: string; status: string; updatedAt: string };
}) {
  const { locale } = useNexusLocale(),
    copy = getResourceReleaseControlCopy(locale),
    field = useId(),
    router = useRouter(),
    lock = useRef(false);
  const [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const release = product.status === "suspended";
  async function send(event: FormEvent) {
    event.preventDefault();
    if (lock.current || saved) return;
    const parsed = resourceModerationCommandSchema.safeParse({
      action: release ? "release" : "suspend",
      reason,
      expectedUpdatedAt: product.updatedAt,
    });
    if (!confirmed || !parsed.success) {
      setError(copy.errors.RESOURCE_MODERATION_INVALID);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/resources/${encodeURIComponent(product.id)}`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const value = await response.json().catch(() => null);
      if (!response.ok || !confirmedResourceModeration(value, product.id, parsed.data)) {
        setError(resourceReleaseControlError(locale, value?.code));
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
    <form onSubmit={send} className="nexus-panel space-y-4 p-5">
      <p role="note" className="text-sm text-secondary">
        {copy.moderationNote}
      </p>
      <fieldset disabled={busy || saved} className="space-y-4">
        <label htmlFor={`${field}-reason`} className="block space-y-2">
          <span className="text-sm">{copy.reason}</span>
          <textarea
            id={`${field}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={2000}
            rows={3}
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
          <span>{release ? copy.confirmRelease : copy.confirmSuspend}</span>
        </label>
      </fieldset>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      ) : null}
      <button type="submit" disabled={busy || saved || !confirmed} className="btn-primary">
        {busy ? copy.saving : release ? copy.release : copy.suspend}
      </button>
    </form>
  );
}
