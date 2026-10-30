"use client";
import type { LibrarySelectionBatchCommand, LibrarySelectionBatchPreview } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  confirmedSelectionBatchPreview,
  confirmedSelectionBatchResult,
} from "../lib/library-selection-batches-confirmation";
import { librarySelectionBatchesCopy } from "../lib/library-selection-batches-i18n";
import { privateApiRequest } from "../lib/private-api-request";
export function LibrarySelectionBatchControls({
  collectionId,
  locale,
  items,
}: {
  collectionId: string;
  locale: string;
  items: { productId: string; title: string | null; downloadable: boolean; hasAccess: boolean }[];
}) {
  const c = librarySelectionBatchesCopy(locale),
    router = useRouter(),
    lock = useRef(false),
    pending = useRef<LibrarySelectionBatchCommand | null>(null);
  const [ids, setIds] = useState<string[]>([]),
    [mode, setMode] = useState<"fixed" | "latest">("fixed"),
    [preview, setPreview] = useState<LibrarySelectionBatchPreview | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const api = `/api/library/collections/${encodeURIComponent(collectionId)}/versions`;
  function edit() {
    setPreview(null);
    setConfirmed(false);
    setError("");
  }
  async function review() {
    if (lock.current || frozen || saved) return;
    if (ids.length < 1 || ids.length > 20) {
      setError(c.invalid);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setPreview(null);
    setConfirmed(false);
    const choice = { mode, productIds: [...ids].sort() };
    try {
      const response = await fetch(
        `${api}/preview`,
        privateApiRequest({ method: "POST", json: choice }),
      );
      const body = await response.json().catch(() => null),
        result = response.ok ? confirmedSelectionBatchPreview(body, collectionId, choice) : null;
      if (result) setPreview(result);
      else setError(c.error);
    } catch {
      setError(c.error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function apply() {
    if (lock.current || saved || !preview) return;
    if (!confirmed) {
      setError(c.invalid);
      return;
    }
    const command = pending.current ?? {
      ...preview.choice,
      requestId: crypto.randomUUID(),
      previewDigest: preview.previewDigest,
    };
    pending.current = command;
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    try {
      const response = await fetch(
        api,
        privateApiRequest({ method: "POST", json: command, timeoutMs: 30000 }),
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !confirmedSelectionBatchResult(body, command, preview)) {
        setError(c.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(c.error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-5">
      <p className="text-secondary">{c.note}</p>
      <fieldset disabled={busy || frozen || saved} className="nexus-panel space-y-3 p-4">
        <legend className="font-semibold">{c.choose}</legend>
        <label className="flex gap-2">
          <input
            type="radio"
            name="selectionMode"
            value="fixed"
            checked={mode === "fixed"}
            onChange={() => {
              setMode("fixed");
              setIds([]);
              edit();
            }}
          />
          {c.fixed}
        </label>
        <label className="flex gap-2">
          <input
            type="radio"
            name="selectionMode"
            value="latest"
            checked={mode === "latest"}
            onChange={() => {
              setMode("latest");
              setIds([]);
              edit();
            }}
          />
          {c.latest}
        </label>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.productId}>
              <label className="flex items-start gap-2 break-words">
                <input
                  type="checkbox"
                  checked={ids.includes(item.productId)}
                  disabled={
                    !(mode === "fixed"
                      ? item.downloadable
                      : item.hasAccess && item.title !== null) ||
                    (!ids.includes(item.productId) && ids.length >= 20)
                  }
                  onChange={(e) => {
                    setIds((previous) =>
                      e.target.checked
                        ? [...previous, item.productId]
                        : previous.filter((id) => id !== item.productId),
                    );
                    edit();
                  }}
                />
                {item.title ?? c.unavailable}
              </label>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          onClick={() => void review()}
          disabled={!ids.length}
          variant="outline"
        >
          {busy ? c.busy : c.preview}
        </Button>
      </fieldset>
      {preview && (
        <section className="nexus-panel space-y-4 p-4">
          <h2>{c.preview}</h2>
          <p>
            {c.revision}: {preview.collection.revision} · {c.changed}: {preview.changedCount}
          </p>
          <ol className="space-y-3">
            {preview.items.map((item) => (
              <li key={item.productId} className="break-words">
                <h3 className="font-semibold">{item.title}</h3>
                <p>
                  {c.version}: {item.version}
                </p>
                <p>
                  {c.previous}: {c[item.previous.mode]} · {c.selectionRevision}:{" "}
                  {item.previous.revision}
                </p>
                <p>
                  {c.next}: {c[item.next.mode]} · {c.selectionRevision}: {item.next.revision}
                </p>
                {item.previous.revision === item.next.revision && <p>{c.unchanged}</p>}
                <code className="break-all text-xs">{item.targetBuildId}</code>
              </li>
            ))}
          </ol>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || frozen || saved}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {c.confirm}
          </label>
          <Button
            type="button"
            disabled={busy || saved || !confirmed || !preview.changedCount}
            onClick={() => void apply()}
            variant="outline"
          >
            {busy ? c.busy : saved ? c.saved : frozen ? c.retry : c.apply}
          </Button>
        </section>
      )}
      {frozen && !saved && <p role="note">{c.frozen}</p>}
      {error && (
        <div>
          <p role="alert" className="text-danger">
            {error}
          </p>
          <a
            href={`/workspace/library/collections/${encodeURIComponent(collectionId)}/versions`}
            className="text-accent underline"
          >
            {c.reload}
          </a>
        </div>
      )}
      {saved && <p role="status">{c.saved}</p>}
    </section>
  );
}
