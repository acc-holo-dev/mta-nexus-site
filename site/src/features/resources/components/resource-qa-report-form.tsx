"use client";

import { Button, ErrorState } from "@nexus/ui";
import { createReportSchema } from "@nexus/validation";
import { type FormEvent, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { GuestAuthLinks } from "../../shell/guest-auth";
import { linkGhostAccentSmBare } from "../../shell/link-shell";
import { surfaceMinSpace2BgP3 } from "../../shell/surface-shell";
import {
  typeBlockMinSpace1XsMuted,
  typeFlexWrapGap2,
  typeXsMuted,
  typeXsSuccess,
} from "../../shell/type-shell";
import { resourceQaCopy, resourceQaError } from "../resource-qa-i18n";

const REPORT_TYPES = createReportSchema.shape.type.options;

export function ResourceQaReportForm({
  threadId,
  locale,
  authenticated,
  loginHref,
  registerHref,
}: {
  threadId: string;
  locale: Locale;
  /** `null` = session probe failed (not a guest). */
  authenticated: boolean | null;
  loginHref: string;
  registerHref: string;
}) {
  const copy = resourceQaCopy(locale);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]>("abuse");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [resultId, setResultId] = useState<string | null>(null);
  const writing = useRef(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (writing.current || pending) return;
    const parsed = createReportSchema.safeParse({
      targetType: "resource_qa_thread",
      targetId: threadId,
      type,
      reason: reason.trim(),
      evidenceUrls: [],
    });
    if (!parsed.success) {
      setError(copy.reportInvalid);
      return;
    }
    writing.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/reports",
        privateApiRequest({
          method: "POST",
          json: parsed.data,
          timeoutMs: 15_000,
        }),
      ).catch(() => null);
      const payload = response ? await response.json().catch(() => null) : null;
      if (!response?.ok) {
        const code =
          payload &&
          typeof payload === "object" &&
          typeof (payload as { code?: unknown }).code === "string"
            ? (payload as { code: string }).code
            : null;
        setError(
          code === "REPORT_OWN_TARGET"
            ? copy.reportOwn
            : code
              ? resourceQaError(locale, code)
              : copy.reportFailed,
        );
        return;
      }
      const id =
        payload &&
        typeof payload === "object" &&
        payload !== null &&
        "report" in payload &&
        payload.report &&
        typeof payload.report === "object" &&
        typeof (payload.report as { id?: unknown }).id === "string"
          ? (payload.report as { id: string }).id
          : null;
      setResultId(id);
      setOpen(false);
      setReason("");
    } finally {
      writing.current = false;
      setPending(false);
    }
  }

  if (authenticated === null) {
    return (
      <ErrorState
        id="resource-qa-report-identity-unavailable"
        title={copy.identityUnavailable}
        description={copy.identityUnavailableDescription}
      />
    );
  }

  if (!authenticated) {
    return (
      <div className="space-y-1">
        <p className={typeXsMuted}>{copy.reportSignIn}</p>
        <GuestAuthLinks
          loginHref={loginHref}
          registerHref={registerHref}
          signInLabel={copy.reportSignInAction}
          createAccountLabel={copy.reportRegisterAction}
        />
      </div>
    );
  }

  if (resultId) {
    return <p className={typeXsSuccess}>{copy.reportSubmitted}</p>;
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={linkGhostAccentSmBare}
        onClick={() => setOpen(true)}
      >
        {copy.report}
      </Button>
    );
  }

  return (
    <form className={surfaceMinSpace2BgP3} onSubmit={onSubmit}>
      <p className={typeXsMuted}>{copy.reportHelp}</p>
      <label className={typeBlockMinSpace1XsMuted}>
        <span>{copy.reportType}</span>
        <select
          className="min-h-11 w-full rounded-lg border border-base bg-page px-3 py-2 text-sm text-secondary"
          value={type}
          disabled={pending}
          onChange={(event) => setType(event.target.value as (typeof REPORT_TYPES)[number])}
        >
          {REPORT_TYPES.map((value) => (
            <option key={value} value={value}>
              {copy.reportTypes[value] ?? value}
            </option>
          ))}
        </select>
      </label>
      <label className={typeBlockMinSpace1XsMuted}>
        <span>{copy.reportReason}</span>
        <textarea
          className="min-h-24 w-full rounded-lg border border-base bg-page px-3 py-2 text-sm text-secondary"
          value={reason}
          maxLength={1000}
          disabled={pending}
          onChange={(event) => setReason(event.target.value)}
          placeholder={copy.reportReasonPlaceholder}
        />
      </label>
      {error ? (
        <ErrorState
          id="resource-qa-report-failed"
          title={error}
          description={getDictionary(locale).errors.formErrorHint}
        />
      ) : null}
      <div className={typeFlexWrapGap2}>
        <Button
          type="submit"
          size="sm"
          className="min-h-11"
          disabled={pending || reason.trim().length < 10}
        >
          {pending ? copy.reportSubmitting : copy.reportSubmit}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError("");
          }}
        >
          {copy.cancel}
        </Button>
      </div>
    </form>
  );
}
