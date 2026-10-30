"use client";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { getManagedServerCopy } from "../lib/managed-server-view";
import {
  confirmsServerVisibilityCommand,
  confirmsServerVisibilityPreview,
  type ServerVisibilityPreview,
} from "../lib/server-workspace-contract";
import { serverWorkspaceCopy, serverWorkspaceError } from "../lib/server-workspace-copy";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
export function ManagedServerVisibilityBatch({
  items,
  locale,
}: {
  items: { id: string; name: string; card: ReactNode }[];
  locale: Locale;
}) {
  const copy = serverWorkspaceCopy(locale),
    labels = getManagedServerCopy(locale),
    router = useRouter();
  const [selected, setSelected] = useState<string[]>([]),
    [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("private"),
    [preview, setPreview] = useState<ServerVisibilityPreview | null>(null),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    locked = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const path = "/api/workspace/servers/visibility";
  function message(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(getUserPlatformCopy(locale))].includes(text)
      ? text
      : fallback;
  }
  function changeSelection(ids: string[]) {
    if (pending.current || locked.current || preview) return;
    setError("");
    setSelected(ids.slice(0, 20));
  }
  function toggle(id: string) {
    if (pending.current || locked.current || preview) return;
    setError("");
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length >= 20
          ? current
          : [...current, id],
    );
  }
  async function review() {
    if (pending.current || locked.current) return;
    if (!selected.length) {
      setError(copy.empty);
      return;
    }
    const input = { serverIds: selected, visibility };
    pending.current = true;
    setBusy(true);
    setError("");
    const active = new AbortController();
    controller.current = active;
    try {
      const raw = await platformRequest(
        `${path}/preview`,
        locale,
        "POST",
        input,
        active.signal,
        serverWorkspaceError,
      );
      if (!mounted.current) return;
      const result = confirmsServerVisibilityPreview(raw, input);
      if (!result) throw Error(copy.unavailable);
      setPreview(result);
    } catch (failure) {
      if (mounted.current) {
        const result = message(failure, copy.unavailable);
        setError(result);
        if (result === copy.changed || result === copy.forbidden) {
          locked.current = true;
          setBlocked(true);
        }
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function commit() {
    if (
      pending.current ||
      locked.current ||
      !preview ||
      !preview.items.some((item) => item.changed)
    )
      return;
    const reviewed = preview;
    pending.current = true;
    locked.current = true;
    setBlocked(true);
    setBusy(true);
    setError("");
    const active = new AbortController();
    controller.current = active;
    try {
      const raw = await platformRequest(
        path,
        locale,
        "POST",
        {
          serverIds: reviewed.items.map((item) => item.id),
          visibility: reviewed.visibility,
          previewRevision: reviewed.previewRevision,
        },
        active.signal,
        serverWorkspaceError,
      );
      if (!mounted.current) return;
      if (!confirmsServerVisibilityCommand(raw, reviewed)) throw Error(copy.uncertain);
      setSaved(true);
      setPreview(null);
      try {
        router.refresh();
      } catch {
        setError(copy.unavailable);
      }
    } catch (failure) {
      if (mounted.current) {
        setPreview(null);
        const result = message(failure, copy.uncertain);
        setError(
          [
            copy.unavailable,
            getUserPlatformCopy(locale).unavailable,
            getUserPlatformCopy(locale).UNCONFIRMED,
          ].includes(result)
            ? copy.uncertain
            : result,
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-busy={busy}>
      <div className="nexus-panel space-y-4 p-5">
        <h2 className="text-lg font-semibold text-primary">{copy.batchTitle}</h2>
        <p className="text-sm text-muted">{copy.batchHelp}</p>
        <fieldset disabled={busy || blocked || !!preview} className="space-y-4">
          <legend className="text-sm text-primary">
            {copy.selected}: {selected.length}
          </legend>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-11 px-0 text-sm text-accent underline"
              onClick={() => changeSelection(items.map((item) => item.id))}
            >
              {copy.selectAll}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-11 px-0 text-sm text-accent underline"
              onClick={() => changeSelection([])}
            >
              {copy.clear}
            </Button>
          </div>
          <label className="flex max-w-sm flex-col gap-2 text-sm text-primary">
            <span>{labels.visibility}</span>
            <select
              value={visibility}
              className={platformFieldClass}
              onChange={(event) => {
                if (!pending.current && !locked.current) {
                  setError("");
                  setVisibility(event.target.value as typeof visibility);
                }
              }}
            >
              {(["public", "unlisted", "private"] as const).map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted">{copy[`${visibility}Help`]}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 font-semibold text-accent"
            disabled={!selected.length}
            onClick={() => void review()}
          >
            {copy.preview}
          </Button>
        </fieldset>
      </div>
      {busy && (
        <p role="status" className="text-sm text-muted">
          {copy.busy}
        </p>
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
      {blocked && !busy && (
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-11 px-0 text-sm text-accent underline"
          onClick={() => window.location.reload()}
        >
          {copy.reload}
        </Button>
      )}
      {preview && (
        <div className="nexus-panel space-y-4 p-5">
          <h3 className="font-semibold text-primary">{copy.previewTitle}</h3>
          <p className="text-sm text-muted">{copy[`${preview.visibility}Help`]}</p>
          <p className="text-xs text-muted">{copy.notes}</p>
          <ol className="space-y-3">
            {preview.items.map((item) => (
              <li key={item.id} className="space-y-2 rounded-lg border border-base p-4">
                <Link
                  href={`/workspace/servers/${encodeURIComponent(item.id)}`}
                  className="inline-flex min-h-11 break-words text-sm text-accent underline"
                >
                  {item.name}
                </Link>
                <p className="text-xs text-muted">
                  {item.organization ? labels.organization : labels.personal} ·{" "}
                  {labels[item.status]}
                </p>
                <p className="text-sm text-primary">
                  {copy.transition}: {labels[item.before]} → {labels[item.after]}
                </p>
                <Link
                  href={`/workspace/servers/${encodeURIComponent(item.id)}/activity`}
                  className="inline-flex min-h-11 text-xs text-accent underline"
                >
                  {copy.actionAll}
                </Link>
              </li>
            ))}
          </ol>
          {!preview.items.some((item) => item.changed) && (
            <p role="status" className="text-sm text-muted">
              {copy.noChanges}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy || blocked || !preview.items.some((item) => item.changed)}
              className="min-h-11 font-semibold text-accent"
              onClick={() => void commit()}
            >
              {copy.confirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || blocked}
              className="h-auto min-h-11 px-0 text-sm text-accent underline"
              onClick={() => setPreview(null)}
            >
              {copy.cancel}
            </Button>
          </div>
        </div>
      )}
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="space-y-2">
            <label className="flex min-h-11 items-center gap-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={
                  busy ||
                  blocked ||
                  !!preview ||
                  (!selected.includes(item.id) && selected.length >= 20)
                }
                onChange={() => toggle(item.id)}
              />
              <span>
                {copy.select}: {item.name}
              </span>
            </label>
            {item.card}
          </li>
        ))}
      </ul>
    </section>
  );
}
