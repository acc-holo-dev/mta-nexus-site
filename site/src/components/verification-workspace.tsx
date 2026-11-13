"use client";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { safeExternalWebUrl } from "@nexus/validation";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { Locale } from "../lib/i18n";
import { getDictionary } from "../lib/i18n";
import {
  PlatformRequestError,
  platformFieldClass,
  platformRequest,
} from "../lib/user-platform-client";
import { verificationApplicationsCopy } from "../lib/verification-applications-copy";
import {
  VERIFICATION_TYPES,
  type VerificationOverview,
  type VerificationQuery,
  type VerificationTargets,
  verificationApplicationSchema,
  verificationOverviewSchema,
  verificationTargetsSchema,
} from "../lib/verification-workspace-contract";
import {
  verificationCopy,
  verificationError,
  verificationMutationError,
} from "../lib/verification-workspace-copy";

type Target = { type: "user" | "developer" | "organization"; id: string; name: string };

const filterNavLinkClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const accentLinkClass = `inline-flex min-h-11 items-center rounded text-sm text-accent underline ${filterNavLinkClass}`;
const pageShellClass = "min-w-0 space-y-6 overflow-x-clip";

export function VerificationWorkspace({
  actorId,
  initial,
  initialTeams,
  filters,
  teamFilters,
  locale,
}: {
  actorId: string;
  initial: VerificationOverview | null;
  initialTeams: VerificationTargets | null;
  filters: VerificationQuery;
  teamFilters: VerificationQuery;
  locale: Locale;
}) {
  const copy = verificationCopy(locale),
    dictionary = getDictionary(locale);
  const [overview, setOverview] = useState(initial),
    [teams, setTeams] = useState(initialTeams);
  const [target, setTarget] = useState<Target | null>(null),
    [proof, setProof] = useState(""),
    [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false),
    [readError, setReadError] = useState(initial && initialTeams ? "" : copy.unavailable),
    [writeError, setWriteError] = useState(""),
    [savedId, setSavedId] = useState("");
  const [verifiedKey, setVerifiedKey] = useState("");
  const [visibleKey, setVisibleKey] = useState(
    () => `nexus:verification-application:v1:${actorId}`,
  );
  const [intent, setIntent] = useState<z.infer<typeof verificationApplicationSchema> | null>(null);
  const intentRef = useRef<z.infer<typeof verificationApplicationSchema> | null>(null);
  const identityEpoch = useRef(0);
  const identityKey = `nexus:verification-application:v1:${actorId}`;
  const currentKey = useRef(identityKey);
  if (currentKey.current !== identityKey) identityEpoch.current += 1;
  currentKey.current = identityKey;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const guard = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    let alive = true;
    controller.current?.abort();
    setVerifiedKey("");
    setIntent(null);
    intentRef.current = null;
    setTarget(null);
    setProof("");
    setNotes("");
    setWriteError("");
    setSavedId("");
    if (visibleKey !== identityKey) {
      setOverview(initial?.profile.id === actorId ? initial : null);
      setTeams(initial?.profile.id === actorId ? initialTeams : null);
    }
    async function restore() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await response.json();
        if (!response.ok || data?.authenticated !== true || data?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(identityKey);
        if (raw) {
          if (raw.length > 10_000) throw new Error("storage");
          const item = JSON.parse(raw);
          const parsed = verificationApplicationSchema.safeParse(item.request);
          if (
            item.actorId !== actorId ||
            !parsed.success ||
            typeof item.targetName !== "string" ||
            item.targetName.length > 200 ||
            (parsed.data.targetType !== "organization" && parsed.data.targetId !== actorId)
          )
            throw new Error("storage");
          if (alive) {
            intentRef.current = parsed.data;
            setIntent(parsed.data);
            setTarget({
              type: parsed.data.targetType,
              id: parsed.data.targetId,
              name: item.targetName,
            });
            setProof(parsed.data.proofUrl);
            setNotes(parsed.data.notes);
          }
        }
        if (alive) {
          setVisibleKey(identityKey);
          setVerifiedKey(identityKey);
        }
      } catch {
        if (alive)
          setWriteError(
            localeRef.current === "ru"
              ? "Не удалось проверить аккаунт или восстановить заявку."
              : "Could not verify the account or restore the application.",
          );
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [actorId, identityKey, initial, initialTeams, visibleKey]);
  const historyParams = new URLSearchParams({ page: String(filters.page), view: filters.view });
  if (filters.type) historyParams.set("type", filters.type);
  const teamParams = new URLSearchParams({ page: String(teamFilters.page), q: teamFilters.query });
  function href(changes: Record<string, string | number>) {
    const params = new URLSearchParams(historyParams);
    params.set("teamsPage", String(teamFilters.page));
    params.set("teamsQ", teamFilters.query);
    for (const [key, value] of Object.entries(changes)) params.set(key, String(value));
    return `/workspace/verification?${params}`;
  }
  async function read() {
    const [history, available] = await Promise.all([
      platformRequest(
        `/api/workspace/verification?${historyParams}`,
        locale,
        "GET",
        undefined,
        controller.current?.signal,
        verificationError,
        { "x-nexus-actor-id": actorId },
      ),
      platformRequest(
        `/api/workspace/verification/targets?${teamParams}`,
        locale,
        "GET",
        undefined,
        controller.current?.signal,
        verificationError,
        { "x-nexus-actor-id": actorId },
      ),
    ]);
    const parsed = verificationOverviewSchema.safeParse(history),
      teamPage = verificationTargetsSchema.safeParse(available);
    if (
      !parsed.success ||
      !teamPage.success ||
      parsed.data.history.page !== filters.page ||
      parsed.data.history.view !== filters.view ||
      teamPage.data.page !== teamFilters.page ||
      parsed.data.profile.id !== actorId ||
      (overview && parsed.data.profile.id !== overview.profile.id)
    )
      throw new Error(copy.unavailable);
    setOverview(parsed.data);
    setTeams(teamPage.data);
  }
  async function reload() {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setReadError("");
    controller.current = new AbortController();
    try {
      await read();
    } catch (caught) {
      setReadError(caught instanceof Error ? caught.message : copy.unavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  function choose(value: Target) {
    if (guard.current || intentRef.current || verifiedKey !== identityKey) return;
    setTarget(value);
    setProof("");
    setNotes("");
    setWriteError("");
    setSavedId("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target || guard.current || verifiedKey !== identityKey) return;
    const requestEpoch = identityEpoch.current;
    const firstAttempt = !intentRef.current;
    const parsed = verificationApplicationSchema.safeParse(
      intentRef.current ?? {
        targetType: target.type,
        targetId: target.id,
        proofUrl: proof,
        notes,
      },
    );
    if (!parsed.success) {
      setWriteError(copy.invalid);
      return;
    }
    if (firstAttempt) {
      try {
        sessionStorage.setItem(
          identityKey,
          JSON.stringify({ actorId, request: parsed.data, targetName: target.name }),
        );
      } catch {
        setVerifiedKey("");
        setWriteError(
          locale === "ru"
            ? "Не удалось сохранить данные восстановления. Заявка не отправлена."
            : "Could not save recovery data. The application was not sent.",
        );
        return;
      }
      intentRef.current = parsed.data;
      setIntent(parsed.data);
    }
    guard.current = true;
    setPending(true);
    setWriteError("");
    setSavedId("");
    controller.current = new AbortController();
    try {
      const response = await platformRequest(
        "/api/workspace/verification",
        locale,
        "POST",
        parsed.data,
        controller.current.signal,
        verificationMutationError,
        { "x-nexus-actor-id": actorId },
      );
      if (requestEpoch !== identityEpoch.current) return;
      const confirmed = z
        .object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
          targetType: z.literal(target.type),
          targetId: z.literal(target.id),
          status: z.literal("pending"),
        })
        .safeParse(response);
      if (!confirmed.success) throw new Error(copy.mutationUnavailable);
      try {
        sessionStorage.removeItem(identityKey);
        intentRef.current = null;
        setIntent(null);
      } catch {
        /* Retain recovery intent if storage is unavailable. */
      }
      setSavedId(confirmed.data.id);
      setProof("");
      setNotes("");
      if (target.type === "organization")
        setTeams((current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === target.id ? { ...item, pending: true } : item,
                ),
              }
            : current,
        );
      else
        setOverview((current) =>
          current
            ? {
                ...current,
                profile: {
                  ...current.profile,
                  ...(target.type === "user"
                    ? { identityPending: true }
                    : { experiencePending: true }),
                },
              }
            : current,
        );
      try {
        await read();
      } catch {
        setReadError(copy.unavailable);
      }
    } catch (caught) {
      if (requestEpoch !== identityEpoch.current) return;
      if (caught instanceof PlatformRequestError && caught.code === "ACTOR_CHANGED")
        setVerifiedKey("");
      if (
        firstAttempt &&
        caught instanceof PlatformRequestError &&
        [
          "VALIDATION_ERROR",
          "ACTOR_CHANGED",
          "ACTOR_ID_REQUIRED",
          "UNAUTHORIZED",
          "FORBIDDEN",
          "RATE_LIMIT_EXCEEDED",
          "VERIFICATION_PENDING",
          "REQUEST_BODY_TOO_LARGE",
          "UNSUPPORTED_MEDIA_TYPE",
        ].includes(String(caught.code))
      ) {
        try {
          sessionStorage.removeItem(identityKey);
          intentRef.current = null;
          setIntent(null);
        } catch {
          /* Keep the original request locked. */
        }
      }
      if (caught instanceof PlatformRequestError && caught.code === "VERIFICATION_PENDING") {
        setWriteError(
          locale === "ru"
            ? "Для этой цели уже есть заявка. Её автор и содержание не подтверждены."
            : "An application already exists for this target. Its author and contents are unconfirmed.",
        );
        return;
      }
      setWriteError(caught instanceof Error ? caught.message : copy.mutationUnavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  if (visibleKey !== identityKey)
    return <ErrorState id="verification-workspace-unavailable" title={copy.unavailable} />;
  const profile = overview?.profile,
    developer = !!profile && ["developer", "admin"].includes(profile.role);
  return (
    <div className={pageShellClass} aria-busy={pending}>
      <div className="flex flex-wrap gap-4">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={pending}
          onClick={() => void reload()}
        >
          {pending ? copy.loading : copy.reload}
        </Button>
        {developer ? (
          <Link href="/settings/developer" className={accentLinkClass}>
            {copy.editProfile}
          </Link>
        ) : null}
        {profile ? (
          <Link href={`/users/${encodeURIComponent(profile.username)}`} className={accentLinkClass}>
            {copy.publicProfile}
          </Link>
        ) : null}
      </div>
      {readError ? (
        <ErrorState
          id="verification-workspace-unavailable"
          title={readError}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              className="h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              onClick={() => void reload()}
            >
              {dictionary.errors.retry}
            </Button>
          }
        />
      ) : null}
      {verifiedKey !== identityKey && writeError ? (
        <ErrorState id="verification-workspace-write-failed" title={writeError} />
      ) : null}
      {profile && (
        <section className="nexus-panel space-y-3 p-5">
          <h2 className="font-heading text-primary">{copy.current}</h2>
          <p className="text-sm text-secondary">
            {copy.user}:{" "}
            {profile.identityVerified
              ? copy.verified
              : profile.identityPending
                ? copy.pending
                : copy.unverified}
          </p>
          <p className="text-xs text-muted">{copy.identityHint}</p>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={
              pending ||
              Boolean(intent) ||
              verifiedKey !== identityKey ||
              profile.identityVerified ||
              profile.identityPending
            }
            onClick={() => choose({ type: "user", id: profile.id, name: profile.name })}
          >
            {copy.apply} · {copy.user}
          </Button>
          {developer ? (
            <>
              <p className="text-sm text-secondary">
                {copy.developer}:{" "}
                {profile.experienceVerified
                  ? copy.verified
                  : profile.experiencePending
                    ? copy.pending
                    : copy.unverified}
              </p>
              {!profile.hasSpecialties ? (
                <p className="text-xs text-muted">{copy.requiresProfile}</p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                disabled={
                  pending ||
                  Boolean(intent) ||
                  verifiedKey !== identityKey ||
                  profile.experienceVerified ||
                  profile.experiencePending ||
                  !profile.hasSpecialties
                }
                onClick={() => choose({ type: "developer", id: profile.id, name: profile.name })}
              >
                {copy.apply} · {copy.developer}
              </Button>
            </>
          ) : null}
        </section>
      )}
      <section className="nexus-panel space-y-4 p-5">
        <h2 className="font-heading text-primary">{copy.manage}</h2>
        <form
          method="GET"
          action="/workspace/verification"
          className="flex min-w-0 flex-wrap items-end gap-3"
        >
          <input type="hidden" name="view" value={filters.view} />
          <input type="hidden" name="page" value={filters.page} />
          {filters.type ? <input type="hidden" name="type" value={filters.type} /> : null}
          <label className="min-w-40 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.query}</span>
            <input
              className={`${platformFieldClass} min-h-11`}
              name="teamsQ"
              defaultValue={teamFilters.query}
              maxLength={100}
            />
          </label>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {copy.search}
          </Button>
        </form>
        {teams?.items.length === 0 ? (
          <EmptyState
            title={copy.noTeams}
            description={copy.noTeamsHint}
            action={
              teamFilters.query.trim() ? (
                <Link href={href({ teamsPage: 1, teamsQ: "" })} className={accentLinkClass}>
                  {copy.clearTeamSearch}
                </Link>
              ) : undefined
            }
          />
        ) : null}
        <div className="min-w-0 space-y-3">
          {teams?.items.map((team) => (
            <div
              key={team.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-base p-3"
            >
              <div className="min-w-0 space-y-1">
                <Link
                  className={accentLinkClass}
                  href={`/organizations/${encodeURIComponent(team.slug)}`}
                >
                  {team.name}
                </Link>
                <p className="text-xs text-muted">
                  {team.verified
                    ? copy.alreadyVerified
                    : team.pending
                      ? copy.teamPending
                      : copy.unverified}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                disabled={
                  pending ||
                  Boolean(intent) ||
                  verifiedKey !== identityKey ||
                  team.pending ||
                  team.verified
                }
                onClick={() => choose({ type: "organization", id: team.id, name: team.name })}
              >
                {copy.choose}
              </Button>
            </div>
          ))}
        </div>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={copy.manage}>
          {teamFilters.page > 1 ? (
            <Link className={accentLinkClass} href={href({ teamsPage: teamFilters.page - 1 })}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center text-muted">
            {copy.page} {teamFilters.page}
          </span>
          {teams?.hasMore && teamFilters.page < 9999 ? (
            <Link className={accentLinkClass} href={href({ teamsPage: teamFilters.page + 1 })}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      </section>
      {target && (
        <section className="nexus-panel space-y-4 p-5">
          <h2 className="font-heading text-primary">{copy.apply}</h2>
          <p className="break-words text-sm text-secondary">
            {copy[target.type]} · {target.name}
          </p>
          {savedId ? (
            <div className="space-y-2">
              <p role="status" className="text-sm text-success">
                {copy.submitted}
              </p>
              <Link
                className={accentLinkClass}
                href={`/workspace/verification/${encodeURIComponent(savedId)}`}
              >
                {copy.title}
              </Link>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={submit}>
              <p className="text-xs text-muted">{copy.proofPrivacy}</p>
              <label className="block space-y-1 text-sm text-secondary">
                <span>{copy.proof}</span>
                <input
                  className={`${platformFieldClass} min-h-11`}
                  type="url"
                  value={proof}
                  required
                  maxLength={2048}
                  disabled={pending}
                  readOnly={Boolean(intent)}
                  onChange={(event) => setProof(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm text-secondary">
                <span>{copy.notes}</span>
                <textarea
                  className={`${platformFieldClass} min-h-11`}
                  rows={4}
                  value={notes}
                  required
                  minLength={10}
                  maxLength={1000}
                  disabled={pending}
                  readOnly={Boolean(intent)}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <Button
                type="submit"
                className="min-h-11"
                isLoading={pending}
                disabled={
                  pending ||
                  verifiedKey !== identityKey ||
                  notes.trim().length < 10 ||
                  !proof.trim()
                }
              >
                {copy.submit}
              </Button>
              {writeError ? (
                <ErrorState id="verification-workspace-write-failed" title={writeError} />
              ) : null}
              {intent ? (
                <ErrorState
                  id="verification-workspace-submit-unconfirmed"
                  title={
                    locale === "ru"
                      ? "Результат отправки не подтверждён. Доступен только точный повтор исходной заявки."
                      : "The submission result is unconfirmed. Only an exact retry of the original application is available."
                  }
                />
              ) : null}
            </form>
          )}
          <Button
            type="button"
            className="h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            variant="ghost"
            disabled={pending || Boolean(intent)}
            onClick={() => setTarget(null)}
          >
            {copy.cancel}
          </Button>
        </section>
      )}
      <section className="nexus-panel min-w-0 space-y-3 p-5">
        <p className="text-sm text-muted">{copy.serverHint}</p>
        <Link href="/workspace/servers" className={accentLinkClass}>
          {copy.servers}
        </Link>
      </section>
      <section className="min-w-0 space-y-4">
        <nav className="flex flex-wrap gap-3" aria-label={copy.title}>
          <Link
            href="/workspace/verification/history"
            className={`inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-sm text-accent ${filterNavLinkClass}`}
          >
            {verificationApplicationsCopy(locale).title}
          </Link>
          {(["pending", "history"] as const).map((view) => (
            <Link
              key={view}
              href={href({ view, page: 1 })}
              aria-current={filters.view === view ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-sm text-accent ${filterNavLinkClass}`}
            >
              {copy[view]}
            </Link>
          ))}
        </nav>
        <form
          method="GET"
          action="/workspace/verification"
          className="flex min-w-0 flex-wrap items-end gap-3"
        >
          <input type="hidden" name="view" value={filters.view} />
          <input type="hidden" name="teamsQ" value={teamFilters.query} />
          <label className="min-w-40 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.type}</span>
            <select
              className={`${platformFieldClass} min-h-11`}
              name="type"
              defaultValue={filters.type ?? ""}
            >
              <option value="">{copy.all}</option>
              {VERIFICATION_TYPES.map((type) => (
                <option value={type} key={type}>
                  {type === "organization" ? copy.organization : copy[type]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {copy.search}
          </Button>
        </form>
        {overview?.history.items.length === 0 ? (
          <EmptyState
            title={copy.noApplications}
            description={filters.type ? copy.noApplicationsFilteredHint : copy.noApplicationsHint}
            action={
              filters.type ? (
                <Link
                  href={`/workspace/verification?${new URLSearchParams({
                    page: "1",
                    view: filters.view,
                    teamsPage: String(teamFilters.page),
                    teamsQ: teamFilters.query,
                  })}`}
                  className={accentLinkClass}
                >
                  {copy.all}
                </Link>
              ) : (
                <Link
                  href={href({
                    view: filters.view === "history" ? "pending" : "history",
                    page: 1,
                  })}
                  className={accentLinkClass}
                >
                  {copy[filters.view === "history" ? "pending" : "history"]}
                </Link>
              )
            }
          />
        ) : null}
        {overview?.history.items.map((application) => (
          <article
            key={application.id}
            id={`verification-${application.id}`}
            className="nexus-panel min-w-0 scroll-mt-20 space-y-3 p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="min-w-0 break-words text-sm font-semibold text-primary">
                {copy[application.targetType]}
              </h3>
              <span className="text-xs text-secondary">{copy[application.status]}</span>
            </div>
            <p className="break-all text-xs text-muted">{application.targetId}</p>
            <Link
              prefetch={false}
              href={`/workspace/verification/${encodeURIComponent(application.id)}`}
              className={accentLinkClass}
            >
              {verificationApplicationsCopy(locale).open}
            </Link>
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">
              {application.notes}
            </p>
            {safeExternalWebUrl(application.proofUrl) ? (
              <a
                className={accentLinkClass}
                href={safeExternalWebUrl(application.proofUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.proof}
              </a>
            ) : null}
            {application.reviewNotes ? (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-primary">{copy.reviewNotes}</h4>
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {application.reviewNotes}
                </p>
              </div>
            ) : null}
            <p className="text-xs text-muted">
              {copy.submittedAt}:{" "}
              <time dateTime={application.createdAt}>
                {new Date(application.createdAt).toLocaleString(
                  locale === "ru" ? "ru-RU" : "en-US",
                  { timeZone: "UTC" },
                )}{" "}
                UTC
              </time>
            </p>
            {application.resolvedAt ? (
              <p className="text-xs text-muted">
                {copy.decidedAt}:{" "}
                <time dateTime={application.resolvedAt}>
                  {new Date(application.resolvedAt).toLocaleString(
                    locale === "ru" ? "ru-RU" : "en-US",
                    { timeZone: "UTC" },
                  )}{" "}
                  UTC
                </time>
              </p>
            ) : null}
          </article>
        ))}
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={copy.title}>
          {filters.page > 1 ? (
            <Link className={accentLinkClass} href={href({ page: filters.page - 1 })}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center text-muted">
            {copy.page} {filters.page}
          </span>
          {overview?.history.hasMore && filters.page < 9999 ? (
            <Link className={accentLinkClass} href={href({ page: filters.page + 1 })}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      </section>
    </div>
  );
}
