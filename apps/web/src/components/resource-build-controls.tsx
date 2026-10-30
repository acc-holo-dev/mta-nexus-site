"use client";
import type { ResourceBuildCommand, ResourceBuildView } from "@nexus/domain";
import { Button, Input } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateRequest } from "../lib/private-request";
import { getResourceBuildWorkspaceCopy } from "../lib/resource-build-workspace-i18n";
import { confirmedBuildCommand } from "../lib/resource-build-workspace-response";
import { useNexusLocale } from "./locale-context";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

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
          <div className="space-y-1.5">
            <label htmlFor={`${prefix}-notes`} className={nativeLabelClass}>
              {copy.notes}
            </label>
            <textarea
              id={`${prefix}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={10000}
              rows={6}
              disabled={blocked}
              className={textareaClass}
            />
          </div>
          <Input
            id={`${prefix}-target`}
            label={copy.target}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            maxLength={64}
            disabled={blocked}
          />
          <Button type="submit" isLoading={pending} disabled={uncertain} className="min-h-11">
            {pending ? copy.working : copy.save}
          </Button>
        </form>
      )}
      {current.status !== "retired" && current.status !== "quarantined" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor={`${prefix}-reason`} className={nativeLabelClass}>
              {copy.reason}
            </label>
            <textarea
              id={`${prefix}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
              maxLength={2000}
              disabled={blocked}
              className={textareaClass}
            />
          </div>
          {editable && !withdrawn && (
            <>
              <p className="text-sm text-secondary">{copy.clean}</p>
              <Button
                type="button"
                disabled={blocked || !trustedScan || dirty || reason.trim().length < 3}
                onClick={() => void command("submit")}
                className="min-h-11"
              >
                {copy.submit}
              </Button>
            </>
          )}
          {current.status === "pending_review" && (
            <Button
              type="button"
              variant="outline"
              disabled={blocked || reason.trim().length < 3}
              onClick={() => void command("withdraw")}
              className="min-h-11"
            >
              {copy.withdraw}
            </Button>
          )}
          <details>
            <summary className="cursor-pointer text-danger">{copy.retire}</summary>
            <p className="py-3 text-sm text-secondary">{copy.retirement}</p>
            <Button
              type="button"
              variant="danger"
              disabled={blocked || reason.trim().length < 3}
              onClick={() => void command("retire")}
              className="min-h-11"
            >
              {copy.retire}
            </Button>
          </details>
        </div>
      )}
      {message && <p role={uncertain ? "alert" : "status"}>{message}</p>}
      {uncertain && (
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          {copy.reload}
        </Button>
      )}
    </section>
  );
}
