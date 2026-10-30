"use client";
import {
  LIBRARY_COLLECTION_MANIFEST_BYTES,
  type LibraryCollectionImportPreview,
  type LibraryCollectionReconcilePreview,
  type LibraryCollectionSnapshot,
} from "@nexus/domain";
import { Button } from "@nexus/ui";
import {
  libraryCollectionImportPreviewSchema,
  libraryCollectionManifestSchema,
  libraryCollectionReconcilePreviewSchema,
} from "@nexus/validation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { libraryCollectionManifestsCopy } from "../lib/library-collection-manifests-i18n";
import { libraryCollectionError, libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { privateApiRequest } from "../lib/private-api-request";
import { LibraryCollectionBatchForm } from "./library-collection-batch";
import { LibraryCollectionReconcileForm } from "./library-collection-reconcile";
export function LibraryCollectionImport({
  collection,
  locale,
  reconcile = false,
}: {
  collection: LibraryCollectionSnapshot;
  locale: "ru" | "en";
  reconcile?: boolean;
}) {
  const c = libraryCollectionsCopy(locale),
    m = libraryCollectionManifestsCopy(locale);
  const [source, setSource] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<
      LibraryCollectionImportPreview | LibraryCollectionReconcilePreview | null
    >(null),
    [frozen, setFrozen] = useState(false);
  const mode = useRef(reconcile).current,
    active = useRef(true),
    generation = useRef(0),
    locked = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      generation.current++;
      controller.current?.abort();
    };
  }, []);
  function clear() {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setError("");
    setPreview(null);
  }
  async function readFile(file: File | undefined) {
    if (locked.current || !active.current) return;
    clear();
    setSource("");
    if (!file) return;
    if (file.size > LIBRARY_COLLECTION_MANIFEST_BYTES) {
      setError(m.invalid);
      return;
    }
    const version = generation.current;
    try {
      const text = await file.text();
      if (!active.current || locked.current || generation.current !== version) return;
      if (new TextEncoder().encode(text).byteLength > LIBRARY_COLLECTION_MANIFEST_BYTES) {
        setError(m.invalid);
        return;
      }
      setSource(text);
    } catch {
      if (active.current && generation.current === version) setError(m.invalid);
    }
  }
  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active.current || locked.current || controller.current) return;
    let value: unknown;
    try {
      if (new TextEncoder().encode(source).byteLength > LIBRARY_COLLECTION_MANIFEST_BYTES)
        throw Error("large");
      value = JSON.parse(source);
    } catch {
      setError(m.invalid);
      return;
    }
    const manifest = libraryCollectionManifestSchema.safeParse(value);
    if (!manifest.success) {
      setError(m.invalid);
      return;
    }
    const version = ++generation.current,
      destination = collection.id,
      abort = new AbortController();
    controller.current = abort;
    setPreview(null);
    setError("");
    setBusy(true);
    try {
      const response = await fetch(
        `/api/library/collections/${encodeURIComponent(destination)}/${mode ? "reconcile-preview" : "import-preview"}`,
        privateApiRequest({ method: "POST", json: manifest.data, signal: abort.signal }),
      );
      const body = await response.json().catch(() => null);
      if (
        !active.current ||
        locked.current ||
        generation.current !== version ||
        abort.signal.aborted
      )
        return;
      const result = mode
        ? libraryCollectionReconcilePreviewSchema.safeParse(body)
        : libraryCollectionImportPreviewSchema.safeParse(body);
      if (
        !response.ok ||
        !result.success ||
        result.data.collection.id !== destination ||
        JSON.stringify(
          result.data.items
            .filter((item) => !mode || ("inManifest" in item && item.inManifest))
            .map((item) => item.productId),
        ) !== JSON.stringify(manifest.data.productIds)
      ) {
        setError(response.ok ? c.retry : libraryCollectionError(locale, body?.code));
        return;
      }
      setPreview(result.data);
    } catch {
      if (active.current && generation.current === version && !abort.signal.aborted)
        setError(c.retry);
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        if (active.current) setBusy(false);
      }
    }
  }
  return (
    <div className="space-y-6">
      <p>{mode ? m.reconcileNote : m.note}</p>
      <form onSubmit={inspect} className="nexus-panel space-y-4 p-5">
        <fieldset disabled={frozen} className="space-y-3">
          <label className="grid gap-1">
            {m.choose}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
          </label>
          <label className="grid gap-1">
            {m.paste}
            <textarea
              value={source}
              maxLength={LIBRARY_COLLECTION_MANIFEST_BYTES}
              rows={7}
              className="rounded border border-base bg-surface p-2 font-mono text-xs"
              onChange={(event) => {
                if (locked.current) return;
                clear();
                setSource(event.target.value);
              }}
            />
          </label>
        </fieldset>
        <Button type="submit" disabled={busy || frozen || !source} variant="outline">
          {busy ? m.busy : m.preview}
        </Button>
        {error && <p role="alert">{error}</p>}
      </form>
      {frozen && <p role="note">{m.frozen}</p>}
      {preview && (
        <section className="space-y-4" aria-label={m.result}>
          <h2>{m.result}</h2>
          <p>
            {m.current}: {preview.collection.name} · {c[preview.collection.status]} · {c.revision}{" "}
            {preview.collection.revision}
          </p>
          <code className="block break-all text-xs">{preview.collection.id}</code>
          <p>
            {c.items}: {preview.itemCount} / {preview.itemLimit} · {m.capacity}:{" "}
            {preview.itemLimit - preview.itemCount}
          </p>
          <p>
            <time dateTime={preview.generatedAt}>{preview.generatedAt}</time>
          </p>
          {!preview.items.length && <p>{m.empty}</p>}
          <ul className="space-y-2">
            {preview.items.map((item) => (
              <li key={item.productId} className="break-words border-t border-base pt-2">
                <p>{item.available ? (item.title ?? c.unavailable) : c.unavailable}</p>
                <code className="block break-all text-xs">{item.productId}</code>
                <p>
                  {mode && "canRemove" in item && item.canRemove
                    ? m.removeCandidate
                    : item.inCollection
                      ? m.present
                      : item.canAdd
                        ? m.eligible
                        : m.blocked}
                </p>
              </li>
            ))}
          </ul>
          {mode ? (
            <LibraryCollectionReconcileForm
              key={`${preview.collection.id}:${preview.collection.revision}:${preview.generatedAt}`}
              locale={locale}
              preview={preview as LibraryCollectionReconcilePreview}
              onFreeze={() => {
                locked.current = true;
                controller.current?.abort();
                setFrozen(true);
              }}
            />
          ) : (
            <LibraryCollectionBatchForm
              key={`${preview.collection.id}:${preview.collection.revision}:${preview.generatedAt}`}
              locale={locale}
              collection={preview.collection}
              action="add-many"
              items={preview.items
                .filter((item) => item.canAdd)
                .map((item) => ({ productId: item.productId, title: item.title, hasAccess: true }))}
              maxSelection={Math.min(preview.batchLimit, preview.itemLimit - preview.itemCount)}
              returnHref={collectionHref(preview.collection.id, "import")}
              onFreeze={() => {
                locked.current = true;
                controller.current?.abort();
                setFrozen(true);
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}
