"use client";
import {
  type ManagedResourceMedia,
  RESOURCE_MEDIA_INPUT_BYTES,
  RESOURCE_MEDIA_LIMIT,
} from "@nexus/domain";
import { Button, Input } from "@nexus/ui";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { resourceMediaCopy } from "../lib/resource-media-i18n";
import { ResourcePreview } from "./resource-preview";

export function ResourceMediaEditor({
  initial,
  locale,
}: {
  initial: ManagedResourceMedia;
  locale: "ru" | "en";
}) {
  const copy = resourceMediaCopy(locale);
  const [current, setCurrent] = useState(initial),
    [items, setItems] = useState(initial.items);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null),
    inFlight = useRef(false);
  useEffect(() => () => abort.current?.abort(), []);
  const endpoint = `/api/products/${encodeURIComponent(current.product.id)}/media`;
  const readonly = ["archived", "suspended"].includes(current.product.status);
  const dirty =
    JSON.stringify(items.map((v) => [v.id, v.caption])) !==
    JSON.stringify(current.items.map((v) => [v.id, v.caption]));
  async function execute(
    method: "GET" | "POST" | "PATCH",
    body?: BodyInit,
    form?: HTMLFormElement,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch(endpoint, {
        method,
        body,
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
        ...(method === "PATCH" ? { headers: { "Content-Type": "application/json" } } : {}),
      });
      const payload = await response.json();
      controller.signal.throwIfAborted();
      if (!response.ok) {
        setError(copy.errors[payload.code as keyof typeof copy.errors] ?? copy.error);
        return;
      }
      if (!payload.product?.updatedAt || !Array.isArray(payload.items))
        throw new Error("Invalid gallery response");
      setCurrent(payload);
      setItems(payload.items);
      setRemoving(null);
      form?.reset();
      if (method !== "GET") setMessage(copy.saved);
    } catch {
      if (!controller.signal.aborted) setError(copy.error);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      inFlight.current = false;
    }
  }
  function move(index: number, target: number) {
    if (busy || readonly || target < 0 || target >= items.length) return;
    const next = [...items],
      [item] = next.splice(index, 1);
    if (item) {
      next.splice(target, 0, item);
      setItems(next);
    }
  }
  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || readonly || dirty) return;
    const form = event.currentTarget,
      body = new FormData(form),
      file = body.get("file");
    if (!(file instanceof File) || !file.size || file.size > RESOURCE_MEDIA_INPUT_BYTES) {
      setError(copy.errors.RESOURCE_MEDIA_LIMIT);
      return;
    }
    body.set("expectedUpdatedAt", current.product.updatedAt);
    void execute("POST", body, form);
  }
  return (
    <div className="space-y-5" aria-busy={busy}>
      {readonly && (
        <p role="note" className="text-warning">
          {copy.readonly}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-secondary">
          {message}
        </p>
      )}
      {busy && (
        <p role="status" className="text-secondary">
          {copy.busy}
        </p>
      )}
      <Button type="button" variant="outline" disabled={busy} onClick={() => void execute("GET")}>
        {copy.reload}
      </Button>
      {!items.length && <p className="text-muted">{copy.empty}</p>}
      <ol className="grid gap-5 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id} className="nexus-panel space-y-3 p-4">
            <div className="aspect-video overflow-hidden rounded-lg bg-inset">
              <ResourcePreview
                src={item.url}
                title={item.caption || current.product.title}
                fallback={copy.previewUnavailable}
              />
            </div>
            <p className="text-xs text-muted">
              {item.width} × {item.height}
              {index === 0 ? ` · ${copy.currentCover}` : ""}
            </p>
            <Input
              id={`media-caption-${item.id}`}
              label={copy.caption}
              value={item.caption}
              maxLength={160}
              disabled={busy || readonly}
              onChange={(event) =>
                setItems(
                  items.map((v) => (v.id === item.id ? { ...v, caption: event.target.value } : v)),
                )
              }
            />
            {!readonly && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || index === 0}
                  onClick={() => move(index, 0)}
                >
                  {copy.cover}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  {copy.up}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  {copy.down}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || dirty}
                  onClick={() => setRemoving(item.id)}
                >
                  {copy.remove}
                </Button>
              </div>
            )}
            {removing === item.id && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || dirty || readonly}
                  onClick={() =>
                    void execute(
                      "PATCH",
                      JSON.stringify({
                        action: "remove",
                        mediaId: item.id,
                        expectedUpdatedAt: current.product.updatedAt,
                      }),
                    )
                  }
                >
                  {copy.confirm}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setRemoving(null)}
                >
                  {copy.cancel}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {!readonly && (
        <>
          {dirty && (
            <p role="note" className="text-sm text-muted">
              {copy.dirty}
            </p>
          )}
          <Button
            type="button"
            disabled={busy || !dirty}
            onClick={() =>
              void execute(
                "PATCH",
                JSON.stringify({
                  action: "save",
                  expectedUpdatedAt: current.product.updatedAt,
                  items: items.map((v) => ({ id: v.id, caption: v.caption })),
                }),
              )
            }
            className="min-h-11"
          >
            {copy.save}
          </Button>
          <form onSubmit={upload} className="nexus-panel space-y-4 p-5">
            <div className="space-y-1.5">
              <label
                htmlFor="media-upload-file"
                className="block font-label uppercase text-secondary"
              >
                {copy.file}
              </label>
              <input
                id="media-upload-file"
                type="file"
                name="file"
                accept="image/png,image/jpeg,image/webp"
                required
                disabled={busy || dirty || items.length >= RESOURCE_MEDIA_LIMIT}
                className="block w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
              />
            </div>
            <Input
              id="media-upload-caption"
              name="caption"
              label={copy.caption}
              maxLength={160}
              defaultValue=""
              disabled={busy || dirty}
            />
            <Button
              type="submit"
              disabled={busy || dirty || items.length >= RESOURCE_MEDIA_LIMIT}
              className="min-h-11"
            >
              {copy.upload}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
