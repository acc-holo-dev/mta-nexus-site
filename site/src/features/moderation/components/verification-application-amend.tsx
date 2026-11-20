"use client";
import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { platformFieldClass, platformRequest } from "../../community/user-platform-client";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { confirmAction } from "../../shell/confirm-action";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import {
  confirmedVerificationApplicationAmend,
  verificationApplicationAmendSchema,
} from "../../trust/verification-applications-contract";
import { verificationCopy } from "../../trust/verification-workspace-copy";
import { linkGhostAccentSm } from "../../shell/link-shell";
import {
  verificationApplicationsCopy,
  verificationApplicationsError,
} from "../verification-applications-copy";
export function VerificationApplicationAmend({
  id,
  revision,
  proofUrl,
  notes,
  locale,
}: {
  id: string;
  revision: string;
  proofUrl: string | null;
  notes: string | null;
  locale: Locale;
}) {
  const router = useRouter(),
    copy = verificationApplicationsCopy(locale),
    labels = verificationCopy(locale),
    formErrorHint = getDictionary(locale).errors.formErrorHint;
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [
      ...Object.values(copy),
      ...Object.values(labels),
      ...Object.values(getUserPlatformCopy(locale)),
    ].includes(text)
      ? text
      : fallback;
  }
  const [proof, setProof] = useState(proofUrl ?? ""),
    [explanation, setExplanation] = useState(notes ?? ""),
    [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(false),
    [notice, setNotice] = useState("");
  const pending = useRef(false),
    alive = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  async function amend(event: FormEvent) {
    event.preventDefault();
    if (pending.current || blocked) return;
    const parsed = verificationApplicationAmendSchema.safeParse({
      proofUrl: proof,
      notes: explanation,
      expectedRevision: revision,
    });
    if (!parsed.success) {
      setNotice(copy.invalid);
      return;
    }
    if (
      !(await confirmAction({
        title: copy.amend,
        object: id,
        consequences: copy.confirm,
        confirmLabel: copy.amend,
        cancelLabel: labels.cancel,
        closeLabel: labels.cancel,
      }))
    )
      return;
    pending.current = true;
    setBusy(true);
    setBlocked(true);
    setNotice("");
    const active = new AbortController();
    controller.current = active;
    try {
      const result = await platformRequest(
        `/api/workspace/verification/${encodeURIComponent(id)}`,
        locale,
        "PATCH",
        parsed.data,
        active.signal,
        verificationApplicationsError,
      );
      if (!alive.current) return;
      if (!confirmedVerificationApplicationAmend(result, id, revision)) throw Error(copy.uncertain);
      setSaved(true);
      setNotice(copy.saved);
      router.refresh();
    } catch (failure) {
      if (alive.current) setNotice(safeMessage(failure, copy.uncertain));
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <form onSubmit={(event) => void amend(event)} aria-busy={busy} className={panelClipSpace4P5}>
      <h2 className="font-semibold text-primary">{copy.amend}</h2>
      <p className="text-xs text-muted">{labels.proofPrivacy}</p>
      <fieldset disabled={busy || blocked} className="space-y-4">
        <label className="block space-y-1 text-sm text-secondary">
          {labels.proof}
          <input
            type="url"
            required
            maxLength={2048}
            value={proof}
            onChange={(event) => setProof(event.target.value)}
            className={`${platformFieldClass} min-h-11`}
          />
        </label>
        <label className="block space-y-1 text-sm text-secondary">
          {labels.notes}
          <textarea
            rows={5}
            required
            minLength={10}
            maxLength={1000}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            className={`${platformFieldClass} min-h-11`}
          />
        </label>
        <Button type="submit" className="min-h-11" isLoading={busy} disabled={busy}>
          {busy ? labels.loading : copy.amend}
        </Button>
      </fieldset>
      {notice && !saved ? (
        <ErrorState id="verification-amend-notice" title={notice} description={formErrorHint} />
      ) : null}
      {notice && saved ? (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      ) : null}
      {blocked && !busy ? (
        <Button
          type="button"
          onClick={() => router.refresh()}
          className={linkGhostAccentSm}
          variant="ghost"
        >
          {labels.reload}
        </Button>
      ) : null}
    </form>
  );
}
