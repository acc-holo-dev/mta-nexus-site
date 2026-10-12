"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResourceReleaseWatch, ResourceReleaseWatchCommand } from "@nexus/domain";
import { privateApiRequest } from "../lib/private-api-request";
import { resourceReleaseWatchesCopy } from "../lib/resource-release-watches-i18n";
import { useNexusLocale } from "./locale-context";
export function ResourceReleaseWatchControl({
  watch,
  available = true,
}: {
  watch: ResourceReleaseWatch;
  available?: boolean;
}) {
  const { locale } = useNexusLocale(),
    copy = resourceReleaseWatchesCopy(locale),
    router = useRouter(),
    lock = useRef(false),
    settled = useRef(false),
    frozen = useRef<{
      productId: string;
      command: ResourceReleaseWatchCommand;
      updatedAt: Date | null;
    } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  async function save() {
    if (lock.current || settled.current || (!frozen.current && !available && !watch.enabled))
      return;
    const request = frozen.current ?? {
      productId: watch.productId,
      command: { enabled: !watch.enabled, expectedRevision: watch.revision },
      updatedAt: watch.updatedAt,
    };
    frozen.current = request;
    setPending(true);
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await fetch(
        `/api/library/watches/${encodeURIComponent(request.productId)}`,
        privateApiRequest({
          method: "POST",
          json: request.command,
          signal: controller.signal,
        }),
      );
      const body = await response.json().catch(() => null);
      if (active.current !== controller) return;
      if (!response.ok) {
        setError(
          body?.code === "RELEASE_WATCH_CONFLICT"
            ? copy.conflict
            : body?.code === "RELEASE_WATCH_LIMIT"
              ? copy.maximum
              : response.status === 404 || body?.code === "RELEASE_WATCH_UNAVAILABLE"
                ? copy.access
                : copy.failed,
        );
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
        return;
      }
      if (
        !body ||
        body.productId !== request.productId ||
        body.enabled !== request.command.enabled ||
        !Number.isSafeInteger(body.revision) ||
        body.revision !== request.command.expectedRevision + 1 ||
        typeof body.updatedAt !== "string" ||
        !Number.isFinite(new Date(body.updatedAt).getTime()) ||
        new Date(body.updatedAt).toISOString() !== body.updatedAt ||
        (request.updatedAt !== null && new Date(body.updatedAt) <= request.updatedAt)
      ) {
        setError(copy.failed);
        return;
      }
      settled.current = true;
      setSaved(true);
      router.refresh();
    } catch {
      if (active.current === controller) setError(copy.failed);
    } finally {
      if (active.current === controller) {
        active.current = null;
        lock.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div className="space-y-2">
      {!pending && (
        <button
          type="button"
          onClick={save}
          disabled={busy || saved || (!available && !watch.enabled)}
          aria-busy={busy}
          className="rounded-md border border-base px-4 py-2 text-sm text-accent disabled:opacity-60"
        >
          {busy ? copy.busy : watch.enabled ? copy.unwatch : copy.watch}
        </button>
      )}
      {pending && !saved && (
        <div className="space-y-2">
          <p role="note" className="text-sm text-muted">
            {copy.pendingNote}
          </p>
          {!blocked && (
            <button
              type="button"
              onClick={save}
              disabled={busy}
              aria-busy={busy}
              className="rounded-md border border-base px-4 py-2 text-sm text-accent disabled:opacity-60"
            >
              {busy ? copy.busy : copy.retrySame}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            disabled={busy}
            className="rounded-md border border-base px-4 py-2 text-sm text-accent disabled:opacity-60"
          >
            {copy.reloadState}
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      ) : null}
    </div>
  );
}
