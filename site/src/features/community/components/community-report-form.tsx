"use client";
import { Button, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { authEntryHref, currentBrowserReturnPath } from "../../shell/auth-return";
import { GuestAuthLinks } from "../../shell/guest-auth";
import { communityReportCreateSchema, REPORT_TYPES } from "../community-report-contract";
import { communityReportCopy, communityReportMutationError } from "../community-report-copy";
import { platformFieldClass } from "../user-platform-client";
import { getUserPlatformCopy } from "../user-platform-copy";
export function CommunityReportForm({
  targetType,
  targetId,
  locale,
  actorId,
}: {
  targetType: "content" | "comment";
  targetId: string;
  locale: Locale;
  actorId: string | null;
}) {
  const pathname = usePathname();
  const copy = communityReportCopy(locale);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(getUserPlatformCopy(locale))].includes(text)
      ? text
      : fallback;
  }
  const dictionary = getDictionary(locale);
  const workspace = dictionary.workspace;
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const [registerHref, setRegisterHref] = useState(() => authEntryHref("register", pathname));
  const [open, setOpen] = useState(false),
    [pending, setPending] = useState(false);
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]>("abuse");
  const [reason, setReason] = useState(""),
    [evidence, setEvidence] = useState("");
  const [error, setError] = useState(""),
    [result, setResult] = useState<{ id: string; created: boolean } | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifiedKey, setVerifiedKey] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [intent, setIntent] = useState<z.infer<typeof communityReportCreateSchema> | null>(null);
  const intentRef = useRef<z.infer<typeof communityReportCreateSchema> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const identityEpoch = useRef(0);
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const storageKey = `nexus:report-intent:v1:${encodeURIComponent(actorId ?? "")}:${targetType}:${encodeURIComponent(targetId)}`;
  useEffect(() => {
    identityEpoch.current += 1;
    controller.current?.abort();
    intentRef.current = null;
    setVerified(false);
    setVerifiedKey("");
    setStorageReady(false);
    setIntent(null);
    setType("abuse");
    setReason("");
    setEvidence("");
    setError("");
    setResult(null);
    setPending(false);
    if (!actorId) return;
    let alive = true;
    async function restore() {
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(storageKey);
        if (raw) {
          if (raw.length > 20_000) throw new Error("storage");
          const item = JSON.parse(raw);
          const parsed = communityReportCreateSchema.safeParse(item?.request);
          if (
            item?.actorId !== actorId ||
            !parsed.success ||
            parsed.data.targetType !== targetType ||
            parsed.data.targetId !== targetId
          )
            throw new Error("storage");
          if (alive) {
            intentRef.current = parsed.data;
            setIntent(parsed.data);
            setType(parsed.data.type);
            setReason(parsed.data.reason);
            setEvidence(parsed.data.evidenceUrls.join("\n"));
          }
        }
        if (alive) {
          setVerified(true);
          setVerifiedKey(storageKey);
          setStorageReady(true);
        }
      } catch {
        if (alive) setError(communityReportCopy(localeRef.current).restoreFailed);
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [actorId, storageKey, targetId, targetType]);
  const guard = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh auth return paths after client navigation.
  useEffect(() => {
    const path = currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [pathname]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (guard.current) return;
    if (!actorId || !verified || verifiedKey !== storageKey || !storageReady) return;
    const requestEpoch = identityEpoch.current;
    const firstAttempt = !intentRef.current;
    const parsed = communityReportCreateSchema.safeParse(
      intentRef.current ?? {
        targetType,
        targetId,
        type,
        reason,
        evidenceUrls: evidence
          .split(/\r?\n/u)
          .map((line) => line.trim())
          .filter(Boolean),
      },
    );
    if (!parsed.success) {
      setError(copy.invalid);
      return;
    }
    if (!intentRef.current) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ actorId, request: parsed.data }));
      } catch {
        setStorageReady(false);
        setError(copy.recoverySaveFailed);
        return;
      }
      intentRef.current = parsed.data;
      setIntent(parsed.data);
    }
    guard.current = true;
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/workspace/reports", {
        ...privateApiRequest({
          method: "POST",
          json: parsed.data,
          signal: controller.current.signal,
          timeoutMs: 15_000,
        }),
        headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
      });
      const data: unknown = await response.json().catch(() => null);
      if (requestEpoch !== identityEpoch.current) return;
      if (!response.ok) {
        const code = data && typeof data === "object" && "code" in data ? data.code : null;
        if (response.status === 401 || code === "ACTOR_CHANGED") setVerified(false);
        if (firstAttempt && [400, 401, 403, 413, 415, 422, 428, 429].includes(response.status)) {
          try {
            sessionStorage.removeItem(storageKey);
            intentRef.current = null;
            setIntent(null);
          } catch {
            // Keep the request locked if storage cannot be cleared.
          }
        }
        throw new Error(communityReportMutationError(locale, code));
      }
      const confirmed = z
        .object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
          created: z.boolean(),
          targetType: z.literal(targetType),
          targetId: z.literal(targetId),
        })
        .safeParse(data);
      if (!confirmed.success) throw new Error(copy.mutationUnavailable);
      try {
        sessionStorage.removeItem(storageKey);
        intentRef.current = null;
        setIntent(null);
      } catch {
        // Preserve the pending request if browser storage cannot be cleared.
      }
      setResult(confirmed.data);
      setReason("");
      setEvidence("");
    } catch (caught) {
      if (requestEpoch === identityEpoch.current)
        setError(safeMessage(caught, copy.mutationUnavailable));
    } finally {
      guard.current = false;
      if (requestEpoch === identityEpoch.current) setPending(false);
    }
  }
  if (!open)
    return (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-auto min-h-11 px-0 text-xs text-muted underline"
      >
        {copy.report}
      </Button>
    );
  return (
    <section
      className="w-full space-y-3 rounded-lg border border-base bg-inset p-4"
      aria-label={copy.reportTitle}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-primary">{copy.reportTitle}</h3>
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-11 px-0 text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          {copy.cancel}
        </Button>
      </div>
      {!actorId ? (
        <GuestAuthLinks
          loginHref={loginHref}
          registerHref={registerHref}
          signInLabel={copy.signIn}
          createAccountLabel={workspace.createAccount}
        />
      ) : !verified || verifiedKey !== storageKey || !storageReady ? (
        error ? (
          <ErrorState title={error} description={dictionary.errors.sessionRetryHint} />
        ) : (
          <p role="status">{copy.checkingSession}</p>
        )
      ) : result ? (
        <div className="space-y-2">
          <p
            role="status"
            className="text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {result.created ? copy.saved : copy.duplicate}
          </p>
          <Link
            className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            href={`/workspace/reports/${encodeURIComponent(result.id)}`}
          >
            {copy.track}
          </Link>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit} aria-busy={pending}>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.category}</span>
            <select
              className={platformFieldClass}
              value={type}
              disabled={pending || !!intent}
              onChange={(event) => setType(event.target.value as typeof type)}
            >
              {REPORT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.reason}</span>
            <textarea
              className={platformFieldClass}
              value={reason}
              required
              minLength={10}
              maxLength={1000}
              rows={4}
              disabled={pending || !!intent}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.evidence}</span>
            <textarea
              className={platformFieldClass}
              value={evidence}
              maxLength={10_000}
              rows={2}
              disabled={pending || !!intent}
              onChange={(event) => setEvidence(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              isLoading={pending}
              disabled={reason.trim().length < 10}
              className="min-h-11"
            >
              {pending ? copy.submitting : intent ? copy.retryOriginal : copy.submit}
            </Button>
            <Link
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              href="/workspace/reports"
            >
              {copy.myReports}
            </Link>
          </div>
          {intent ? (
            <ErrorState title={copy.submissionUnconfirmed} description={copy.formErrorHint} />
          ) : null}
          {error ? <ErrorState title={error} description={copy.errorMayHaveSaved} /> : null}
        </form>
      )}
    </section>
  );
}
