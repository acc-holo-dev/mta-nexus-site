"use client";
import type {
  LibraryCollectionCommand,
  LibraryCollectionSnapshot,
  LibraryCollectionCopyPreview,
} from "@nexus/domain";
import { libraryCollectionCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { confirmedCollectionCommand } from "../lib/library-collections-confirmation";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { privateApiRequest } from "../lib/private-api-request";
export function LibraryCollectionCommandForm({
  locale,
  collection,
  action = "create",
  productId,
  copyPreview,
}: {
  locale: "ru" | "en";
  collection?: LibraryCollectionSnapshot;
  action?: Exclude<LibraryCollectionCommand["action"], "add-many" | "remove-many">;
  productId?: string;
  copyPreview?: LibraryCollectionCopyPreview;
}) {
  const c = libraryCollectionsCopy(locale),
    router = useRouter(),
    field = useId();
  const pending = useRef<LibraryCollectionCommand | null>(null),
    lock = useRef(false);
  const [name, setName] = useState(
      action === "rename" || action === "duplicate" ? (collection?.name ?? "") : "",
    ),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || saved) return;
    if ((action === "archive" || action === "duplicate") && !checked) {
      setError(c.invalid);
      return;
    }
    if (
      action === "duplicate" &&
      (!collection ||
        !copyPreview ||
        copyPreview.source.id !== collection.id ||
        copyPreview.source.name !== collection.name ||
        copyPreview.source.status !== collection.status ||
        copyPreview.source.revision !== collection.revision)
    ) {
      setError(c.invalid);
      return;
    }
    const parsed = libraryCollectionCommandSchema.safeParse(
      pending.current ?? {
        requestId: crypto.randomUUID(),
        action,
        ...(action === "create" || action === "rename" || action === "duplicate" ? { name } : {}),
        ...(action !== "create" ? { expectedRevision: collection?.revision } : {}),
        ...(action === "add" || action === "remove" ? { productId } : {}),
        ...(action === "duplicate"
          ? {
              sourceCollectionId: copyPreview?.source.id,
              expectedItemCount: copyPreview?.itemCount,
              sourceDigest: copyPreview?.sourceDigest,
            }
          : {}),
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
        `/api/library/collections${collection && action !== "duplicate" ? `/${encodeURIComponent(collection.id)}` : ""}`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const body = await response.json().catch(() => null),
        id = response.ok ? confirmedCollectionCommand(body, parsed.data, collection) : null;
      if (!id) {
        setError(libraryCollectionError(locale, body?.code));
        return;
      }
      setSaved(true);
      if (action === "create" || action === "duplicate") router.push(collectionHref(id));
      router.refresh();
    } catch {
      setError(c.retry);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {(action === "create" || action === "rename" || action === "duplicate") && (
        <label htmlFor={field} className="block space-y-1">
          <span className="text-sm">{c.name}</span>
          <input
            id={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            disabled={busy || frozen || saved}
            className="w-full rounded border border-base bg-surface p-2"
          />
        </label>
      )}
      {(action === "archive" || action === "duplicate") && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            disabled={busy || frozen || saved}
            required
          />
          {action === "duplicate" ? c.copyConfirm : c.archiveConfirm}
        </label>
      )}
      <button
        type="submit"
        disabled={busy || saved}
        className="rounded border border-base px-3 py-2 text-sm text-accent disabled:opacity-60"
      >
        {busy ? c.busy : saved ? c.saved : frozen && error ? c.retryAction : c[action]}
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
          <a href={collectionHref(collection?.id)} className="text-sm text-accent underline">
            {c.reload}
          </a>
        </div>
      )}
      {saved && (
        <p role="status" className="sr-only">
          {c.saved}
        </p>
      )}
    </form>
  );
}
