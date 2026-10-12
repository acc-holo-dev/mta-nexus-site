"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LibraryCollectionCommand, LibraryCollectionSnapshot } from "@nexus/domain";
import { LIBRARY_COLLECTION_BATCH_LIMIT, LIBRARY_COLLECTION_ITEM_LIMIT } from "@nexus/domain";
import { libraryCollectionCommandSchema } from "@nexus/validation";
import { confirmedCollectionCommand } from "../lib/library-collections-confirmation";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { privateApiRequest } from "../lib/private-api-request";
type CopyCommand = Extract<LibraryCollectionCommand, { action: "copy-items" }>;
type Destination = LibraryCollectionSnapshot & { itemCount: number; presentProductIds: string[] };
export function LibraryCollectionItemCopyForm({
  source,
  items,
  destinations,
  locale,
}: {
  source: LibraryCollectionSnapshot;
  items: { productId: string; title: string | null }[];
  destinations: Destination[];
  locale: "en" | "ru";
}) {
  const c = libraryCollectionsCopy(locale);
  const [ids, setIds] = useState<string[]>([]),
    [destinationId, setDestinationId] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(false),
    [savedDestinationId, setSavedDestinationId] = useState(""),
    [error, setError] = useState("");
  const lock = useRef(false),
    settled = useRef(false),
    active = useRef<AbortController | null>(null),
    pending = useRef<{
      command: CopyCommand;
      destination: LibraryCollectionSnapshot;
      url: string;
    } | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  const destination = destinations.find((item) => item.id === destinationId);
  const additions = destination
    ? ids.filter((id) => !destination.presentProductIds.includes(id)).length
    : 0;
  const overCapacity =
    !!destination && destination.itemCount + additions > LIBRARY_COLLECTION_ITEM_LIMIT;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || settled.current) return;
    let request = pending.current;
    if (!request) {
      if (!confirmed || !destination || overCapacity) return;
      const parsed = libraryCollectionCommandSchema.safeParse({
        requestId: crypto.randomUUID(),
        action: "copy-items",
        sourceCollectionId: source.id,
        expectedSourceRevision: source.revision,
        expectedRevision: destination.revision,
        productIds: ids,
      });
      if (!parsed.success || parsed.data.action !== "copy-items") {
        setError(c.invalid);
        return;
      }
      request = {
        command: parsed.data,
        destination: {
          id: destination.id,
          name: destination.name,
          status: destination.status,
          revision: destination.revision,
        },
        url: `/api/library/collections/${encodeURIComponent(destination.id)}`,
      };
      pending.current = request;
    }
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await fetch(
        request.url,
        privateApiRequest({
          method: "POST",
          json: request.command,
          signal: controller.signal,
          timeoutMs: 30000,
        }),
      );
      const body = await response.json().catch(() => null);
      if (active.current !== controller) return;
      if (!response.ok || !confirmedCollectionCommand(body, request.command, request.destination)) {
        setError(libraryCollectionError(locale, body?.code));
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
        return;
      }
      settled.current = true;
      setSavedDestinationId(request.destination.id);
      setSaved(true);
    } catch {
      if (active.current === controller) setError(c.retry);
    } finally {
      if (active.current === controller) {
        active.current = null;
        lock.current = false;
        setBusy(false);
      }
    }
  }
  if (!destinations.length) return <p role="note">{c.noDestination}</p>;
  if (!items.length) return <p>{c.emptyItems}</p>;
  return (
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5">
      <p role="note" className="text-sm text-secondary">
        {c.copyItemsNote}
      </p>
      <fieldset disabled={busy || frozen || saved} className="space-y-4">
        <legend>
          {c.selected}: {ids.length} / {LIBRARY_COLLECTION_BATCH_LIMIT}
        </legend>
        <label className="grid gap-2">
          {c.destination}
          <select
            value={destinationId}
            onChange={(event) => {
              setDestinationId(event.target.value);
              setConfirmed(false);
            }}
            className="rounded border border-base bg-inset px-3 py-2"
            required
          >
            <option value="">{c.destination}</option>
            {destinations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {c.revision} {item.revision} · {item.itemCount} /{" "}
                {LIBRARY_COLLECTION_ITEM_LIMIT}
              </option>
            ))}
          </select>
        </label>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.productId}>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={ids.includes(item.productId)}
                  disabled={
                    !ids.includes(item.productId) && ids.length >= LIBRARY_COLLECTION_BATCH_LIMIT
                  }
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIds((previous) =>
                      checked
                        ? [...new Set([...previous, item.productId])]
                        : previous.filter((id) => id !== item.productId),
                    );
                    setConfirmed(false);
                  }}
                />
                <span className="break-words">
                  {item.title ?? c.unavailable}
                  {item.title === null && (
                    <code className="block break-all text-xs">{item.productId}</code>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {destination && (
          <p className="text-sm">
            {c.additions}: {additions} · {destination.itemCount + additions} /{" "}
            {LIBRARY_COLLECTION_ITEM_LIMIT}
          </p>
        )}
        {overCapacity && <p role="alert">{c.quota}</p>}
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            required
          />
          {c.copyItemsConfirm}
        </label>
      </fieldset>
      {!blocked && !saved && (
        <button
          type="submit"
          disabled={
            busy || (!frozen && (!confirmed || !ids.length || !destination || overCapacity))
          }
          aria-busy={busy}
          className="rounded border border-base px-4 py-2 text-sm text-accent disabled:opacity-60"
        >
          {busy ? c.busy : frozen ? c.retryAction : c["copy-items"]}
        </button>
      )}
      {frozen && !saved && (
        <div className="space-y-2">
          <p role="note" className="text-sm text-muted">
            {c.frozen}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => window.location.reload()}
            className="text-accent underline"
          >
            {c.reload}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-warning">
          {error}
        </p>
      )}
      {saved && (
        <div className="space-y-2">
          <p role="status">{c.saved}</p>
          <a href={collectionHref(savedDestinationId)} className="text-accent underline">
            {c.openDestination}
          </a>
        </div>
      )}
    </form>
  );
}
