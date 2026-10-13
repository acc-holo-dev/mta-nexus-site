"use client";
import {
  LIBRARY_COLLECTION_BATCH_LIMIT,
  type LibraryCollectionCommand,
  type LibraryCollectionSnapshot,
} from "@nexus/domain";
import { libraryCollectionCommandSchema, libraryCollectionReceiptSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { confirmedCollectionCommand } from "../lib/library-collections-confirmation";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { privateApiRequest } from "../lib/private-api-request";
import {
  collectionReceiptHref,
  libraryCollectionReceiptsCopy,
} from "../lib/library-collection-receipts-i18n";

export function LibraryCollectionBatchForm({
  locale,
  collection,
  action,
  items,
  maxSelection = LIBRARY_COLLECTION_BATCH_LIMIT,
  returnHref,
  onFreeze,
}: {
  locale: "ru" | "en";
  collection: LibraryCollectionSnapshot;
  action: "add-many" | "remove-many";
  items: { productId: string; title: string | null; hasAccess: boolean }[];
  maxSelection?: number;
  returnHref?: string;
  onFreeze?: () => void;
}) {
  const c = libraryCollectionsCopy(locale),
    router = useRouter(),
    pending = useRef<{
      command: Extract<LibraryCollectionCommand, { action: "add-many" | "remove-many" }>;
      collection: LibraryCollectionSnapshot;
      endpoint: string;
      reloadHref: string;
    } | null>(null),
    reviewed = useRef<string | null>(null),
    lock = useRef(false),
    settled = useRef(false),
    active = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const [ids, setIds] = useState<string[]>([]),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [saved, setSaved] = useState(false),
    [receiptId, setReceiptId] = useState(""),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  const selectionLimit = Number.isInteger(maxSelection)
    ? Math.max(0, Math.min(LIBRARY_COLLECTION_BATCH_LIMIT, maxSelection))
    : 0;
  const fingerprint = JSON.stringify({ collection, action, selectionLimit, items, ids });
  const acknowledged = checked && reviewed.current === fingerprint;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !active.current ||
      lock.current ||
      settled.current ||
      (!pending.current && collection.status !== "active")
    )
      return;
    if (
      !pending.current &&
      (!acknowledged ||
        collection.revision >= 2147483647 ||
        ids.length > selectionLimit ||
        ids.some(
          (id) =>
            !items.some(
              (item) => item.productId === id && (action !== "add-many" || item.hasAccess),
            ),
        ))
    ) {
      setError(c.invalid);
      return;
    }
    const parsed = libraryCollectionCommandSchema.safeParse(
      pending.current?.command ?? {
        requestId: crypto.randomUUID(),
        action,
        productIds: ids,
        expectedRevision: collection.revision,
      },
    );
    if (
      !parsed.success ||
      (parsed.data.action !== "add-many" && parsed.data.action !== "remove-many")
    ) {
      setError(c.invalid);
      return;
    }
    const fresh = pending.current === null;
    pending.current ??= {
      command: parsed.data,
      collection: {
        id: collection.id,
        name: collection.name,
        status: collection.status,
        revision: collection.revision,
      },
      endpoint: `/api/library/collections/${encodeURIComponent(collection.id)}`,
      reloadHref: returnHref ?? collectionHref(collection.id),
    };
    const attempt = pending.current,
      abort = new AbortController();
    controller.current = abort;
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    if (fresh) onFreeze?.();
    try {
      const response = await fetch(
        attempt.endpoint,
        privateApiRequest({
          method: "POST",
          json: attempt.command,
          timeoutMs: 30000,
          signal: abort.signal,
        }),
      );
      const body = await response.json().catch(() => null);
      if (!active.current || abort.signal.aborted) return;
      if (!response.ok || !confirmedCollectionCommand(body, attempt.command, attempt.collection)) {
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
        setError(libraryCollectionError(locale, body?.code));
        return;
      }
      settled.current = true;
      setReceiptId(libraryCollectionReceiptSchema.parse(body.receipt).id);
      setSaved(true);
      router.refresh();
    } catch {
      if (active.current && !abort.signal.aborted) setError(c.retry);
    } finally {
      lock.current = false;
      if (active.current && !abort.signal.aborted) setBusy(false);
      if (controller.current === abort) controller.current = null;
    }
  }
  if (!items.length && !pending.current) return null;
  const shownAction = pending.current?.command.action ?? action;
  const shownCollection = pending.current?.collection ?? collection;
  const shownItems = pending.current
    ? pending.current.command.productIds.map(
        (productId) =>
          items.find((item) => item.productId === productId) ?? {
            productId,
            title: null,
            hasAccess: false,
          },
      )
    : items;
  return (
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5">
      <h2 className="font-semibold">{c[shownAction]}</h2>
      <p className="break-words text-sm">
        {c.destination}: {shownCollection.name} · {c.revision} {shownCollection.revision}
      </p>
      <p className="text-sm text-secondary">{c.batchLimit}</p>
      <fieldset
        disabled={
          busy ||
          frozen ||
          saved ||
          collection.status !== "active" ||
          collection.revision >= 2147483647
        }
        className="space-y-3"
      >
        <legend className="text-sm">
          {c.selected}: {ids.length} / {selectionLimit}
        </legend>
        <ul className="space-y-2">
          {shownItems.map((item) => (
            <li key={item.productId}>
              <label className="flex items-start gap-2 break-words">
                <input
                  type="checkbox"
                  checked={ids.includes(item.productId)}
                  disabled={
                    (shownAction === "add-many" && !item.hasAccess) ||
                    (!ids.includes(item.productId) && ids.length >= selectionLimit)
                  }
                  onChange={(e) => {
                    if (!active.current || pending.current || lock.current || settled.current)
                      return;
                    const selected = e.target.checked;
                    if (
                      selected &&
                      (ids.includes(item.productId) ||
                        ids.length >= selectionLimit ||
                        (action === "add-many" && !item.hasAccess))
                    )
                      return;
                    reviewed.current = null;
                    setIds((previous) =>
                      selected
                        ? previous.includes(item.productId) || previous.length >= selectionLimit
                          ? previous
                          : [...previous, item.productId]
                        : previous.filter((id) => id !== item.productId),
                    );
                    setChecked(false);
                    setError("");
                  }}
                />
                <span>
                  {item.title ?? c.unavailable}
                  {item.title === null && (
                    <code className="block break-all text-xs">{item.productId}</code>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => {
              if (active.current && !pending.current && !lock.current && !settled.current) {
                reviewed.current = e.target.checked ? fingerprint : null;
                setChecked(e.target.checked);
              }
            }}
            required
          />
          {c.batchConfirm}
        </label>
      </fieldset>
      <button
        type="submit"
        disabled={
          busy ||
          saved ||
          blocked ||
          (!pending.current &&
            (!acknowledged ||
              !ids.length ||
              ids.length > selectionLimit ||
              collection.status !== "active" ||
              collection.revision >= 2147483647))
        }
        className="rounded border border-base px-3 py-2 text-sm text-accent disabled:opacity-60"
      >
        {busy
          ? c.busy
          : saved
            ? c.saved
            : blocked
              ? c.reload
              : frozen
                ? c.retryAction
                : c[shownAction]}
      </button>
      {frozen && !saved && (
        <p role="note" className="text-xs text-muted">
          {c.frozen}
        </p>
      )}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-warning">
            {error}
          </p>
          <a
            href={pending.current?.reloadHref ?? returnHref ?? collectionHref(collection.id)}
            className="text-sm text-accent underline"
          >
            {c.reload}
          </a>
        </div>
      )}
      {saved && (
        <div className="space-y-2">
          <p role="status">{c.saved}</p>
          <code className="block break-all text-xs">
            {c.receipt}: {receiptId}
          </code>
          <a href={collectionReceiptHref(receiptId)} className="text-accent underline">
            {libraryCollectionReceiptsCopy(locale).open}
          </a>
          <a
            href={collectionHref(pending.current?.collection.id ?? collection.id, "history")}
            className="text-accent underline"
          >
            {c.history}
          </a>
          <a
            href={pending.current?.reloadHref ?? returnHref ?? collectionHref(collection.id)}
            className="text-accent underline"
          >
            {c.reload}
          </a>
        </div>
      )}
    </form>
  );
}
