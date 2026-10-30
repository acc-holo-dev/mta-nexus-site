"use client";
import { Button } from "@nexus/ui";
import { resourceModerationCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedResourceModeration } from "../lib/resource-release-control-confirmation";
import {
  getResourceReleaseControlCopy,
  resourceReleaseControlError,
} from "../lib/resource-release-control-i18n";
import { useNexusLocale } from "./locale-context";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";
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
        <div className="space-y-1.5">
          <label htmlFor={`${field}-reason`} className={nativeLabelClass}>
            {copy.reason}
          </label>
          <textarea
            id={`${field}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={2000}
            rows={3}
            required
            className={textareaClass}
          />
        </div>
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
      <Button type="submit" isLoading={busy} disabled={saved || !confirmed} className="min-h-11">
        {busy ? copy.saving : release ? copy.release : copy.suspend}
      </Button>
    </form>
  );
}
