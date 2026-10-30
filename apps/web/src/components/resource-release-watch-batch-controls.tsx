"use client";
import {
  RESOURCE_RELEASE_WATCH_BATCH_LIMIT,
  RESOURCE_RELEASE_WATCH_LIMIT,
  type ResourceReleaseWatchDisableCommand,
  type ResourceReleaseWatchEnableCommand,
} from "@nexus/domain";
import { Button } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedResourceReleaseWatchBatch } from "../lib/resource-release-watch-batch-confirmation";
import { resourceReleaseWatchesCopy } from "../lib/resource-release-watches-i18n";
export function ResourceReleaseWatchBatchControls({
  items,
  locale,
  collection,
  activeWatchCount = 0,
  resume = false,
}: {
  items: {
    productId: string;
    enabled: boolean;
    revision: number;
    title: string | null;
    available?: boolean;
  }[];
  collection?: { id: string; revision: number; status: "active" | "archived" };
  activeWatchCount?: number;
  resume?: boolean;
  locale: Locale;
}) {
  const enabling = collection !== undefined || resume;
  const eligible = items.filter((item) =>
    enabling
      ? item.available === true && !item.enabled && (!resume || item.revision >= 1)
      : item.enabled,
  );
  const capacity = enabling
    ? Math.max(
        0,
        Math.min(
          RESOURCE_RELEASE_WATCH_BATCH_LIMIT,
          RESOURCE_RELEASE_WATCH_LIMIT - activeWatchCount,
        ),
      )
    : RESOURCE_RELEASE_WATCH_BATCH_LIMIT;
  const copy = resourceReleaseWatchesCopy(locale),
    router = useRouter(),
    lock = useRef(false),
    settled = useRef(false),
    active = useRef<AbortController | null>(null),
    scope = useRef<{ url: string; enabling: boolean } | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  const [selected, setSelected] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState<
      ResourceReleaseWatchDisableCommand | ResourceReleaseWatchEnableCommand | null
    >(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const frozen = useRef<
    ResourceReleaseWatchDisableCommand | ResourceReleaseWatchEnableCommand | null
  >(null);
  async function send() {
    if (
      lock.current ||
      settled.current ||
      saved ||
      blocked ||
      (!pending && (!confirmed || !selected.length))
    )
      return;
    const command = frozen.current ?? {
      ...(collection ? { expectedCollectionRevision: collection.revision } : {}),
      items: eligible
        .filter((item) => selected.includes(item.productId))
        .map(({ productId, revision }) => ({ productId, expectedRevision: revision }))
        .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)),
    };
    if (
      !command.items.length ||
      command.items.length > RESOURCE_RELEASE_WATCH_BATCH_LIMIT ||
      (!pending && command.items.length > capacity)
    )
      return;
    frozen.current = command;
    const requestScope = scope.current ?? {
      url: collection
        ? `/api/library/collections/${encodeURIComponent(collection.id)}/watches`
        : resume
          ? "/api/library/watches/resume"
          : "/api/library/watches/disable",
      enabling,
    };
    scope.current = requestScope;
    const controller = new AbortController();
    active.current = controller;
    lock.current = true;
    setPending(command);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        requestScope.url,
        privateApiRequest({ method: "POST", json: command, signal: controller.signal }),
      );
      const body = await response.json().catch(() => null);
      if (active.current !== controller) return;
      if (
        !response.ok ||
        !confirmedResourceReleaseWatchBatch(body, command, requestScope.enabling)
      ) {
        setError(
          body?.code === "RELEASE_WATCH_LIMIT"
            ? copy.maximum
            : body?.code === "RELEASE_WATCH_UNAVAILABLE"
              ? copy.access
              : response.status === 409
                ? copy.conflict
                : copy.failed,
        );
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
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
  if (!pending && (!eligible.length || collection?.status === "archived")) return null;
  const title = resume ? copy.resumeTitle : enabling ? copy.enrollTitle : copy.batchTitle,
    note = resume ? copy.resumeNote : enabling ? copy.enrollNote : copy.batchNote,
    confirm = resume ? copy.confirmResume : enabling ? copy.confirmEnroll : copy.confirmBatch,
    apply = resume ? copy.applyResume : enabling ? copy.applyEnroll : copy.applyBatch;
  return (
    <section className="nexus-panel space-y-4 p-5">
      <h2>{title}</h2>
      <p className="text-sm text-secondary">{note}</p>
      {enabling && capacity === 0 && <p role="note">{copy.maximum}</p>}
      <fieldset disabled={busy || saved || pending !== null} className="space-y-3">
        <legend className="sr-only">{title}</legend>
        {eligible.map((item) => (
          <label key={item.productId} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(item.productId)}
              disabled={!selected.includes(item.productId) && selected.length >= capacity}
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
          <span>{confirm}</span>
        </label>
      </fieldset>
      {!pending && (
        <Button
          type="button"
          variant="outline"
          disabled={busy || saved || !confirmed || !selected.length || selected.length > capacity}
          onClick={() => void send()}
        >
          {apply}
        </Button>
      )}
      {pending && !saved && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{copy.pendingNote}</p>
          {!blocked && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void send()}>
              {copy.retrySame}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => window.location.reload()}
          >
            {copy.reloadState}
          </Button>
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
