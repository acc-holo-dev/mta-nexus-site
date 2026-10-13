"use client";
import type {
  LibraryCollectionCommand,
  LibraryCollectionSnapshot,
  LibraryCollectionCopyPreview,
} from "@nexus/domain";
import { libraryCollectionCommandSchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
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
  returnHref,
}: {
  locale: "ru" | "en";
  collection?: LibraryCollectionSnapshot;
  action?: Exclude<
    LibraryCollectionCommand["action"],
    "add-many" | "remove-many" | "copy-items" | "move-items" | "reconcile-items"
  >;
  productId?: string;
  copyPreview?: LibraryCollectionCopyPreview;
  returnHref?: string;
}) {
  const c = libraryCollectionsCopy(locale),
    router = useRouter(),
    field = useId();
  const pending = useRef<{
      command: LibraryCollectionCommand;
      collection?: LibraryCollectionSnapshot;
      endpoint: string;
      reloadHref: string;
    } | null>(null),
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
  const [name, setName] = useState(
      action === "rename" || action === "duplicate" ? (collection?.name ?? "") : "",
    ),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [saved, setSaved] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active.current || lock.current || settled.current) return;
    if (!pending.current && (action === "archive" || action === "duplicate") && !checked) {
      setError(c.invalid);
      return;
    }
    if (
      !pending.current &&
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
      pending.current?.command ?? {
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
    pending.current ??= {
      command: parsed.data,
      collection: collection
        ? {
            id: collection.id,
            name: collection.name,
            status: collection.status,
            revision: collection.revision,
          }
        : undefined,
      endpoint: `/api/library/collections${collection && action !== "duplicate" ? `/${encodeURIComponent(collection.id)}` : ""}`,
      reloadHref: returnHref ?? collectionHref(collection?.id),
    };
    const attempt = pending.current;
    const abort = new AbortController();
    controller.current = abort;
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    try {
      const response = await fetch(
        attempt.endpoint,
        privateApiRequest({ method: "POST", json: attempt.command, signal: abort.signal }),
      );
      const body = await response.json().catch(() => null),
        id = response.ok
          ? confirmedCollectionCommand(body, attempt.command, attempt.collection)
          : null;
      if (!active.current || abort.signal.aborted) return;
      if (!id) {
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
        setError(libraryCollectionError(locale, body?.code));
        return;
      }
      settled.current = true;
      setSaved(true);
      if (attempt.command.action === "create" || attempt.command.action === "duplicate")
        router.push(collectionHref(id));
      router.refresh();
    } catch {
      if (active.current && !abort.signal.aborted) setError(c.retry);
    } finally {
      lock.current = false;
      if (active.current && !abort.signal.aborted) setBusy(false);
      if (controller.current === abort) controller.current = null;
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
        disabled={busy || saved || blocked}
        className="rounded border border-base px-3 py-2 text-sm text-accent disabled:opacity-60"
      >
        {busy
          ? c.busy
          : saved
            ? c.saved
            : blocked
              ? c.reload
              : frozen && error
                ? c.retryAction
                : c[action]}
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
            href={pending.current?.reloadHref ?? returnHref ?? collectionHref(collection?.id)}
            className="text-sm text-accent underline"
          >
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
