"use client";
import type { LibraryCollectionCommand, LibraryCollectionChangesPreview } from "@nexus/domain";
import { libraryCollectionCommandSchema, libraryCollectionReceiptSchema } from "@nexus/validation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { libraryCollectionsCopy, libraryCollectionError } from "../lib/library-collections-i18n";
import { libraryCollectionManifestsCopy } from "../lib/library-collection-manifests-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { confirmedCollectionCommand } from "../lib/library-collections-confirmation";
import { privateApiRequest } from "../lib/private-api-request";
import {
  collectionReceiptHref,
  libraryCollectionReceiptsCopy,
} from "../lib/library-collection-receipts-i18n";
type Command = Extract<LibraryCollectionCommand, { action: "reconcile-items" }>;
export function LibraryCollectionReconcileForm({
  preview,
  locale,
  onFreeze,
  returnHref,
}: {
  preview: LibraryCollectionChangesPreview;
  locale: "en" | "ru";
  onFreeze: () => void;
  returnHref?: string;
}) {
  const c = libraryCollectionsCopy(locale),
    m = libraryCollectionManifestsCopy(locale),
    router = useRouter();
  const [selected, setSelected] = useState<string[]>([]),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(""),
    [error, setError] = useState("");
  const mounted = useRef(true),
    lock = useRef(false),
    settled = useRef(false),
    reviewed = useRef<string | null>(null),
    controller = useRef<AbortController | null>(null),
    pending = useRef<{
      command: Command;
      preview: LibraryCollectionChangesPreview;
      endpoint: string;
      reloadHref: string;
    } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const shown = pending.current?.preview ?? preview,
    choices = shown.items.filter((item) => item.canAdd || item.canRemove);
  const adds =
    pending.current?.command.addProductIds ??
    choices
      .filter((item) => item.canAdd && selected.includes(item.productId))
      .map((item) => item.productId);
  const removes =
    pending.current?.command.removeProductIds ??
    choices
      .filter((item) => item.canRemove && selected.includes(item.productId))
      .map((item) => item.productId);
  const nextCount = shown.itemCount - removes.length + adds.length,
    capacity = nextCount >= 0 && nextCount <= shown.itemLimit;
  const writable = shown.collection.status === "active" && shown.collection.revision < 2147483647;
  const fingerprint = JSON.stringify({ preview, selected }),
    acknowledged = checked && reviewed.current === fingerprint;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mounted.current || lock.current || settled.current) return;
    if (!pending.current) {
      if (
        !acknowledged ||
        !writable ||
        !capacity ||
        selected.length !== adds.length + removes.length
      ) {
        setError(c.invalid);
        return;
      }
      const parsed = libraryCollectionCommandSchema.safeParse({
        requestId: crypto.randomUUID(),
        action: "reconcile-items",
        expectedRevision: shown.collection.revision,
        addProductIds: adds,
        removeProductIds: removes,
      });
      if (!parsed.success || parsed.data.action !== "reconcile-items") {
        setError(c.invalid);
        return;
      }
      pending.current = {
        command: parsed.data,
        preview: {
          ...preview,
          collection: { ...preview.collection },
          items: preview.items.map((item) => ({ ...item })),
        },
        endpoint: `/api/library/collections/${encodeURIComponent(preview.collection.id)}`,
        reloadHref: returnHref ?? collectionHref(preview.collection.id, "reconcile"),
      };
      onFreeze();
    }
    const attempt = pending.current,
      abort = new AbortController();
    controller.current = abort;
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    try {
      const response = await fetch(
        attempt.endpoint,
        privateApiRequest({
          method: "POST",
          json: attempt.command,
          signal: abort.signal,
          timeoutMs: 30000,
        }),
      );
      const body = await response.json().catch(() => null);
      if (!mounted.current || abort.signal.aborted) return;
      if (
        !response.ok ||
        !confirmedCollectionCommand(body, attempt.command, attempt.preview.collection)
      ) {
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
        setError(libraryCollectionError(locale, body?.code));
        return;
      }
      const receipt = libraryCollectionReceiptSchema.parse(body.receipt);
      settled.current = true;
      setSaved(receipt.id);
      router.refresh();
    } catch {
      if (mounted.current && !abort.signal.aborted) setError(c.retry);
    } finally {
      lock.current = false;
      if (mounted.current && !abort.signal.aborted) setBusy(false);
      if (controller.current === abort) controller.current = null;
    }
  }
  if (!choices.length && !pending.current) return <p>{m.noChanges}</p>;
  const shownIds = pending.current ? [...adds, ...removes] : selected;
  return (
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5">
      <h2>{c["reconcile-items"]}</h2>
      <p>
        {c.destination}: {shown.collection.name} · {c.revision} {shown.collection.revision}
      </p>
      <code className="block break-all text-xs">{shown.collection.id}</code>
      <p>
        {c.add}: {adds.length} · {c.remove}: {removes.length} · {c.selected}: {shownIds.length} /{" "}
        {shown.batchLimit}
      </p>
      <p>
        {m.planned}: {nextCount} / {shown.itemLimit}
      </p>
      {!capacity && <p role="alert">{c.fullCollection}</p>}
      <fieldset disabled={frozen || busy || !!saved || !writable} className="space-y-3">
        <legend>{c.selected}</legend>
        <ul className="space-y-2">
          {choices
            .filter((item) => !pending.current || shownIds.includes(item.productId))
            .map((item) => (
              <li key={item.productId}>
                <label className="flex gap-2 break-words">
                  <input
                    type="checkbox"
                    checked={shownIds.includes(item.productId)}
                    disabled={
                      !shownIds.includes(item.productId) && selected.length >= shown.batchLimit
                    }
                    onChange={(event) => {
                      if (!mounted.current || pending.current || lock.current || settled.current)
                        return;
                      const value = event.target.checked;
                      setSelected((previous) =>
                        value
                          ? previous.includes(item.productId) ||
                            previous.length >= preview.batchLimit
                            ? previous
                            : [...previous, item.productId]
                          : previous.filter((id) => id !== item.productId),
                      );
                      reviewed.current = null;
                      setChecked(false);
                      setError("");
                    }}
                  />
                  <span>
                    {item.canAdd ? c.add : c.remove}:{" "}
                    {item.available ? (item.title ?? c.unavailable) : c.unavailable}
                    <code className="block break-all text-xs">{item.productId}</code>
                  </span>
                </label>
              </li>
            ))}
        </ul>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            required
            onChange={(event) => {
              if (!mounted.current || pending.current || lock.current || settled.current) return;
              reviewed.current = event.target.checked ? fingerprint : null;
              setChecked(event.target.checked);
            }}
          />
          {m.reconcileConfirm}
        </label>
      </fieldset>
      <button
        type="submit"
        disabled={
          busy ||
          !!saved ||
          blocked ||
          (!pending.current && (!acknowledged || !selected.length || !capacity || !writable))
        }
        className="rounded border border-base px-3 py-2"
      >
        {busy
          ? c.busy
          : saved
            ? c.saved
            : blocked
              ? c.reload
              : frozen
                ? c.retryAction
                : c["reconcile-items"]}
      </button>
      {frozen && !saved && <p role="note">{c.frozen}</p>}
      {error && <p role="alert">{error}</p>}
      {(error || saved) && (
        <a
          href={
            pending.current?.reloadHref ??
            returnHref ??
            collectionHref(shown.collection.id, "reconcile")
          }
          className="text-accent underline"
        >
          {c.reload}
        </a>
      )}
      {saved && (
        <div>
          <p role="status">{c.saved}</p>
          <code className="block break-all text-xs">
            {c.receipt}: {saved}
          </code>
          <a href={collectionReceiptHref(saved)} className="text-accent underline">
            {libraryCollectionReceiptsCopy(locale).open}
          </a>
          <a
            href={collectionHref(shown.collection.id, "history")}
            className="text-accent underline"
          >
            {c.history}
          </a>
        </div>
      )}
    </form>
  );
}
