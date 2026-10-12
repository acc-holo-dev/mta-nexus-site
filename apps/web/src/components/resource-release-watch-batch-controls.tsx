"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RESOURCE_RELEASE_WATCH_BATCH_LIMIT,
  type ResourceReleaseWatchDisableCommand,
} from "@nexus/domain";
import type { Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { resourceReleaseWatchesCopy } from "../lib/resource-release-watches-i18n";
import { confirmedResourceReleaseWatchBatch } from "../lib/resource-release-watch-batch-confirmation";
export function ResourceReleaseWatchBatchControls({
  items,
  locale,
}: {
  items: { productId: string; enabled: boolean; revision: number; title: string | null }[];
  locale: Locale;
}) {
  const copy = resourceReleaseWatchesCopy(locale),
    router = useRouter(),
    lock = useRef(false);
  const [selected, setSelected] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState<ResourceReleaseWatchDisableCommand | null>(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const frozen = useRef<ResourceReleaseWatchDisableCommand | null>(null);
  async function send() {
    if (lock.current || saved || blocked || (!pending && (!confirmed || !selected.length))) return;
    const command = frozen.current ?? {
      items: items
        .filter((item) => selected.includes(item.productId) && item.enabled)
        .map(({ productId, revision }) => ({ productId, expectedRevision: revision }))
        .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)),
    };
    if (!command.items.length || command.items.length > RESOURCE_RELEASE_WATCH_BATCH_LIMIT) return;
    frozen.current = command;
    lock.current = true;
    setPending(command);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/library/watches/disable",
        privateApiRequest({ method: "POST", json: command }),
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !confirmedResourceReleaseWatchBatch(body, command)) {
        setError(response.status === 409 ? copy.conflict : copy.failed);
        if ([400, 401, 403, 404, 409].includes(response.status)) setBlocked(true);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(copy.failed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!items.some((item) => item.enabled)) return null;
  return (
    <section className="nexus-panel space-y-4 p-5">
      <h2>{copy.batchTitle}</h2>
      <p className="text-sm text-secondary">{copy.batchNote}</p>
      <fieldset disabled={busy || saved || pending !== null} className="space-y-3">
        <legend className="sr-only">{copy.batchTitle}</legend>
        {items
          .filter((item) => item.enabled)
          .map((item) => (
            <label key={item.productId} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(item.productId)}
                disabled={
                  !selected.includes(item.productId) &&
                  selected.length >= RESOURCE_RELEASE_WATCH_BATCH_LIMIT
                }
                onChange={(event) => {
                  const checked = event.target.checked;
                  setSelected((previous) =>
                    checked
                      ? [...new Set([...previous, item.productId])]
                      : previous.filter((id) => id !== item.productId),
                  );
                  setConfirmed(false);
                }}
              />
              <span className="break-words">{item.title ?? copy.privateResource}</span>
            </label>
          ))}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>{copy.confirmBatch}</span>
        </label>
      </fieldset>
      {!pending && (
        <button
          type="button"
          disabled={busy || saved || !confirmed || !selected.length}
          onClick={() => void send()}
          className="rounded-md border border-base px-4 py-2 text-sm"
        >
          {copy.applyBatch}
        </button>
      )}
      {pending && !saved && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{copy.pendingNote}</p>
          {!blocked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void send()}
              className="rounded-md border border-base px-4 py-2 text-sm"
            >
              {copy.retrySame}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => window.location.reload()}
            className="rounded-md border border-base px-4 py-2 text-sm"
          >
            {copy.reloadState}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      )}
    </section>
  );
}
