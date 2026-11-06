"use client";

import { Button, ErrorState } from "@nexus/ui";
import { createReportSchema } from "@nexus/validation";
import { type FormEvent, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { platformReportCopy, platformReportError } from "../lib/platform-report-i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { GuestAuthLinks } from "./guest-auth-links";

const REPORT_TYPES = createReportSchema.shape.type.options;
type ObjectReportTarget = "product" | "server" | "user";

export function ObjectReportForm({
  targetType,
  targetId,
  locale,
  authenticated,
  loginHref,
  registerHref,
}: {
  targetType: ObjectReportTarget;
  targetId: string;
  locale: Locale;
  authenticated: boolean;
  loginHref: string;
  registerHref: string;
}) {
  const copy = platformReportCopy(locale);
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
      targetType,
      targetId,
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
        if (response?.status === 409) {
          setError(copy.reportExists);
          const existingId =
            payload &&
            typeof payload === "object" &&
            typeof (payload as { reportId?: unknown }).reportId === "string"
              ? (payload as { reportId: string }).reportId
              : null;
          if (existingId) setResultId(existingId);
          return;
        }
        const code =
          payload &&
          typeof payload === "object" &&
          typeof (payload as { code?: unknown }).code === "string"
            ? (payload as { code: string }).code
            : null;
        setError(platformReportError(locale, code));
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

  if (!authenticated) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted">{copy.reportSignIn}</p>
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
    return (
      <p className="text-xs text-success">
        {copy.reportSubmitted}{" "}
        <a
          href={`/workspace/platform-reports/${encodeURIComponent(resultId)}`}
          className="underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.detail}
        </a>
      </p>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 px-0 text-sm text-accent underline"
        onClick={() => setOpen(true)}
      >
        {copy.report}
      </Button>
    );
  }

  return (
    <form
      className="min-w-0 space-y-2 rounded-lg border border-base bg-surface p-3"
      onSubmit={onSubmit}
    >
      <p className="text-xs text-muted">{copy.reportHelp}</p>
      <label className="block min-w-0 space-y-1 text-xs text-muted">
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
      <label className="block min-w-0 space-y-1 text-xs text-muted">
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
      {error ? <ErrorState id="object-report-failed" title={error} /> : null}
      <div className="flex flex-wrap gap-2">
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
