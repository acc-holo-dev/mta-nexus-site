"use client";
import {
  LIBRARY_COLLECTION_BATCH_LIMIT,
  type LibraryCollectionCommand,
  type LibraryCollectionSnapshot,
} from "@nexus/domain";
import { libraryCollectionCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { confirmedCollectionCommand } from "../lib/library-collections-confirmation";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { privateApiRequest } from "../lib/private-api-request";

export function LibraryCollectionBatchForm({
  locale,
  collection,
  action,
  items,
}: {
  locale: "ru" | "en";
  collection: LibraryCollectionSnapshot;
  action: "add-many" | "remove-many";
  items: { productId: string; title: string | null; hasAccess: boolean }[];
}) {
  const c = libraryCollectionsCopy(locale),
    router = useRouter(),
    pending = useRef<LibraryCollectionCommand | null>(null),
    lock = useRef(false);
  const [ids, setIds] = useState<string[]>([]),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || saved || collection.status !== "active") return;
    if (!checked) {
      setError(c.invalid);
      return;
    }
    const parsed = libraryCollectionCommandSchema.safeParse(
      pending.current ?? {
        requestId: crypto.randomUUID(),
        action,
        productIds: ids,
        expectedRevision: collection.revision,
      },
    );
    if (!parsed.success) {
      setError(c.invalid);
      return;
    }
    pending.current = parsed.data;
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    try {
      const response = await fetch(
        `/api/library/collections/${encodeURIComponent(collection.id)}`,
        privateApiRequest({ method: "POST", json: parsed.data, timeoutMs: 30000 }),
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !confirmedCollectionCommand(body, parsed.data, collection)) {
        setError(libraryCollectionError(locale, body?.code));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(c.retry);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!items.length) return null;
  return (
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5">
      <h2 className="font-semibold">{c[action]}</h2>
      <p className="text-sm text-secondary">{c.batchLimit}</p>
      <fieldset
        disabled={busy || frozen || saved || collection.status !== "active"}
        className="space-y-3"
      >
        <legend className="text-sm">
          {c.selected}: {ids.length} / {LIBRARY_COLLECTION_BATCH_LIMIT}
        </legend>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.productId}>
              <label className="flex items-start gap-2 break-words">
                <input
                  type="checkbox"
                  checked={ids.includes(item.productId)}
                  disabled={
                    (action === "add-many" && !item.hasAccess) ||
                    (!ids.includes(item.productId) && ids.length >= LIBRARY_COLLECTION_BATCH_LIMIT)
                  }
                  onChange={(e) => {
                    const selected = e.target.checked;
                    setIds((previous) =>
                      selected
                        ? [...previous, item.productId]
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
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            required
          />
          {c.batchConfirm}
        </label>
      </fieldset>
      <button
        type="submit"
        disabled={busy || saved || !checked || !ids.length || collection.status !== "active"}
        className="rounded border border-base px-3 py-2 text-sm text-accent disabled:opacity-60"
      >
        {busy ? c.busy : saved ? c.saved : frozen ? c.retryAction : c[action]}
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
          <a href={collectionHref(collection.id)} className="text-sm text-accent underline">
            {c.reload}
          </a>
        </div>
      )}
      {saved && <p role="status">{c.saved}</p>}
    </form>
  );
}
