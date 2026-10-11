"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ResourceBuildView, ResourceBuildCommand } from "@nexus/domain";
import { privateRequest } from "../lib/private-request";
import { confirmedBuildCommand } from "../lib/resource-build-workspace-response";
import { getResourceBuildWorkspaceCopy } from "../lib/resource-build-workspace-i18n";
import { useNexusLocale } from "./locale-context";
type EditorBuild = Pick<
  ResourceBuildView,
  "id" | "productId" | "version" | "status" | "revision" | "releaseNotes" | "mtaVersionTarget"
>;
export function ResourceBuildControls({
  build,
  withdrawn,
  trustedScan,
}: {
  build: EditorBuild;
  withdrawn: boolean;
  trustedScan: boolean;
}) {
  const { locale } = useNexusLocale(),
    copy = getResourceBuildWorkspaceCopy(locale),
    router = useRouter();
  const prefix = useId(),
    busy = useRef(false);
  const [current, setCurrent] = useState(build),
    [pending, setPending] = useState(false);
  const [notes, setNotes] = useState(build.releaseNotes ?? ""),
    [target, setTarget] = useState(build.mtaVersionTarget ?? "");
  const [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const editable = current.status === "draft" || current.status === "rejected";
  const dirty =
    notes !== (current.releaseNotes ?? "") || target !== (current.mtaVersionTarget ?? "");
  async function command(action: ResourceBuildCommand["action"]) {
    if (busy.current || uncertain) return;
    const input: ResourceBuildCommand =
      action === "save"
        ? {
            action,
            expectedRevision: current.revision,
            releaseNotes: notes.trim(),
            mtaVersionTarget: target.trim(),
          }
        : { action, expectedRevision: current.revision, reason: reason.trim() };
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/products/${current.productId}/builds/${current.id}`,
        privateRequest({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(15000),
        }),
      );
      const body: unknown = await response.json().catch(() => null);
      const confirmed = confirmedBuildCommand(response.status, body, current, input);
      if (!confirmed) {
        setMessage(response.status === 409 ? copy.conflict : copy.failed);
        setUncertain(true);
        return;
      }
      setCurrent(confirmed);
      setNotes(confirmed.releaseNotes ?? "");
      setTarget(confirmed.mtaVersionTarget ?? "");
      setMessage(copy.saved);
      setReason("");
      router.refresh();
    } catch {
      setMessage(copy.failed);
      setUncertain(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void command("save");
  }
  const inputClass = "w-full rounded-lg border border-base bg-inset p-3 text-primary";
  const buttonClass = "rounded-lg border border-base px-4 py-2 text-primary disabled:opacity-40";
  const blocked = pending || uncertain;
  return (
    <section className="space-y-4" aria-busy={pending}>
      <p className="text-sm text-secondary">{copy.immutable}</p>
      <p className="text-sm text-muted">
        {copy.revision}: {current.revision} · {copy.statuses[current.status]}
      </p>
      {withdrawn && <p className="text-warning">{copy.unavailable}</p>}
      {current.status === "pending_review" && <p className="text-secondary">{copy.pending}</p>}
      {editable && !withdrawn && (
        <form onSubmit={save} className="space-y-3">
          <label htmlFor={`${prefix}-notes`} className="block">
            {copy.notes}
          </label>
          <textarea
            id={`${prefix}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={10000}
            rows={6}
            disabled={blocked}
            className={inputClass}
          />
          <label htmlFor={`${prefix}-target`} className="block">
            {copy.target}
          </label>
          <input
            id={`${prefix}-target`}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            maxLength={64}
            disabled={blocked}
            className={inputClass}
          />
          <button type="submit" disabled={blocked} className={buttonClass}>
            {pending ? copy.working : copy.save}
          </button>
        </form>
      )}
      {current.status !== "retired" && current.status !== "quarantined" && (
        <div className="space-y-3">
          <label htmlFor={`${prefix}-reason`} className="block">
            {copy.reason}
          </label>
          <textarea
            id={`${prefix}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={3}
            maxLength={2000}
            disabled={blocked}
            className={inputClass}
          />
          {editable && !withdrawn && (
            <>
              <p className="text-sm text-secondary">{copy.clean}</p>
              <button
                type="button"
                disabled={blocked || !trustedScan || dirty || reason.trim().length < 3}
                onClick={() => void command("submit")}
                className={buttonClass}
              >
                {copy.submit}
              </button>
            </>
          )}
          {current.status === "pending_review" && (
            <button
              type="button"
              disabled={blocked || reason.trim().length < 3}
              onClick={() => void command("withdraw")}
              className={buttonClass}
            >
              {copy.withdraw}
            </button>
          )}
          <details>
            <summary className="cursor-pointer text-danger">{copy.retire}</summary>
            <p className="py-3 text-sm text-secondary">{copy.retirement}</p>
            <button
              type="button"
              disabled={blocked || reason.trim().length < 3}
              onClick={() => void command("retire")}
              className={buttonClass}
            >
              {copy.retire}
            </button>
          </details>
        </div>
      )}
      {message && <p role={uncertain ? "alert" : "status"}>{message}</p>}
      {uncertain && (
        <button type="button" onClick={() => window.location.reload()} className={buttonClass}>
          {copy.reload}
        </button>
      )}
    </section>
  );
}
