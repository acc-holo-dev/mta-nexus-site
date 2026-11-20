"use client";
import { Button, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { platformFieldClass, platformRequest } from "../../community/user-platform-client";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import {
  ActionConfirmCheckbox,
  actionConfirmCheckboxFocusClass,
} from "../../shell/action-confirm-checkbox";
import { confirmAction } from "../../shell/confirm-action";
import { linkGhostAccentSm, linkMinHAccentSemibold } from "../../shell/link-shell";
import { pageShellStack4 } from "../../shell/page-shell";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { surfaceSpace2P4 } from "../../shell/surface-shell";
import {
  typeFlexWrapGap3,
  typeLgSemiboldPrimary,
  typeSemiboldPrimary,
  typeSmPrimary,
  typeSmSuccess,
} from "../../shell/type-shell";
import { getManagedServerCopy } from "../managed-server-copy";
import {
  confirmsServerVisibilityCommand,
  confirmsServerVisibilityPreview,
  type ServerVisibilityPreview,
} from "../server-workspace-contract";
import { serverWorkspaceCopy, serverWorkspaceError } from "../server-workspace-copy";
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
    [commitAcknowledged, setCommitAcknowledged] = useState(false),
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
  function safeMessage(failure: unknown, fallback: string) {
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
      setCommitAcknowledged(false);
    } catch (failure) {
      if (mounted.current) {
        const result = safeMessage(failure, copy.unavailable);
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
      !preview.items.some((item) => item.changed) ||
      !commitAcknowledged
    )
      return;
    const reviewed = preview;
    if (
      reviewed.items.some((item) => item.changed) &&
      !(await confirmAction({
        title: copy.previewTitle,
        object: `${reviewed.items.filter((item) => item.changed).length}`,
        scope: labels[reviewed.visibility],
        consequences: copy.confirmWrite,
        confirmLabel: copy.confirm,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
      }))
    )
      return;
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
        const result = safeMessage(failure, copy.uncertain);
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
    <section className={pageShellStack4} aria-busy={busy}>
      <div className={panelSpace4P5}>
        <h2 className={typeLgSemiboldPrimary}>{copy.batchTitle}</h2>
        <p className="text-sm text-muted">{copy.batchHelp}</p>
        <fieldset disabled={busy || blocked || !!preview} className="space-y-4">
          <legend className={typeSmPrimary}>
            {copy.selected}: {selected.length}
          </legend>
          <div className={typeFlexWrapGap3}>
            <Button
              type="button"
              variant="ghost"
              className={linkGhostAccentSm}
              onClick={() => changeSelection(items.map((item) => item.id))}
            >
              {copy.selectAll}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={linkGhostAccentSm}
              onClick={() => changeSelection([])}
            >
              {copy.clear}
            </Button>
          </div>
          <label className="flex max-w-sm flex-col gap-2 text-sm text-primary">
            <span>{labels.visibility}</span>
            <select
              value={visibility}
              className={`${platformFieldClass} min-h-11`}
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
            className={linkMinHAccentSemibold}
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
      {error ? (
        <ErrorState title={error} description={getDictionary(locale).errors.formErrorHint} />
      ) : null}
      {saved && (
        <p role="status" className={typeSmSuccess}>
          {copy.saved}
        </p>
      )}
      {blocked && !busy && (
        <Button
          type="button"
          variant="ghost"
          className={linkGhostAccentSm}
          onClick={() => router.refresh()}
        >
          {copy.reload}
        </Button>
      )}
      {preview && (
        <div className={panelSpace4P5}>
          <h3 className={typeSemiboldPrimary}>{copy.previewTitle}</h3>
          <p className="text-sm text-muted">{copy[`${preview.visibility}Help`]}</p>
          <p className="text-xs text-muted">{copy.notes}</p>
          <ol className="space-y-3">
            {preview.items.map((item) => (
              <li key={item.id} className={surfaceSpace2P4}>
                <Link
                  href={`/workspace/servers/${encodeURIComponent(item.id)}`}
                  className="inline-flex min-h-11 break-words text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {item.name}
                </Link>
                <p className="text-xs text-muted">
                  {item.organization ? labels.organization : labels.personal} ·{" "}
                  {labels[item.status]}
                </p>
                <p className={typeSmPrimary}>
                  {copy.transition}: {labels[item.before]} → {labels[item.after]}
                </p>
                <Link
                  href={`/workspace/servers/${encodeURIComponent(item.id)}/activity`}
                  className="inline-flex min-h-11 text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
          <ActionConfirmCheckbox
            id="managed-server-visibility-batch-commit"
            checked={commitAcknowledged}
            required
            disabled={busy || blocked || !preview.items.some((item) => item.changed)}
            checkboxClassName={actionConfirmCheckboxFocusClass}
            onCheckedChange={setCommitAcknowledged}
          >
            {copy.commitConfirm}
          </ActionConfirmCheckbox>
          <div className={typeFlexWrapGap3}>
            <Button
              type="button"
              variant="outline"
              disabled={
                busy ||
                blocked ||
                !preview.items.some((item) => item.changed) ||
                !commitAcknowledged
              }
              className={linkMinHAccentSemibold}
              onClick={() => void commit()}
            >
              {copy.confirm}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || blocked}
              className={linkGhostAccentSm}
              onClick={() => {
                setPreview(null);
                setCommitAcknowledged(false);
              }}
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
