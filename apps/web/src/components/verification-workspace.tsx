"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@nexus/ui";
import { safeExternalWebUrl } from "@nexus/validation";
import type { Locale } from "../lib/i18n";
import {
  VERIFICATION_TYPES,
  verificationApplicationSchema,
  verificationOverviewSchema,
  verificationTargetsSchema,
  type VerificationOverview,
  type VerificationTargets,
  type VerificationQuery,
} from "../lib/verification-workspace-contract";
import {
  verificationCopy,
  verificationError,
  verificationMutationError,
} from "../lib/verification-workspace-copy";
import { platformFieldClass, platformRequest } from "../lib/user-platform-client";
type Target = { type: "user" | "developer" | "organization"; id: string; name: string };
export function VerificationWorkspace({
  initial,
  initialTeams,
  filters,
  teamFilters,
  locale,
}: {
  initial: VerificationOverview | null;
  initialTeams: VerificationTargets | null;
  filters: VerificationQuery;
  teamFilters: VerificationQuery;
  locale: Locale;
}) {
  const copy = verificationCopy(locale);
  const [overview, setOverview] = useState(initial),
    [teams, setTeams] = useState(initialTeams);
  const [target, setTarget] = useState<Target | null>(null),
    [proof, setProof] = useState(""),
    [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false),
    [readError, setReadError] = useState(initial && initialTeams ? "" : copy.unavailable),
    [writeError, setWriteError] = useState(""),
    [savedId, setSavedId] = useState("");
  const guard = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
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
      ),
      platformRequest(
        `/api/workspace/verification/targets?${teamParams}`,
        locale,
        "GET",
        undefined,
        controller.current?.signal,
        verificationError,
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
    if (guard.current) return;
    setTarget(value);
    setProof("");
    setNotes("");
    setWriteError("");
    setSavedId("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target || guard.current) return;
    const parsed = verificationApplicationSchema.safeParse({
      targetType: target.type,
      targetId: target.id,
      proofUrl: proof,
      notes,
    });
    if (!parsed.success) {
      setWriteError(copy.invalid);
      return;
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
      );
      const confirmed = z
        .object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
          targetType: z.literal(target.type),
          targetId: z.literal(target.id),
          status: z.literal("pending"),
        })
        .safeParse(response);
      if (!confirmed.success) throw new Error(copy.mutationUnavailable);
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
      setWriteError(caught instanceof Error ? caught.message : copy.mutationUnavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  const profile = overview?.profile,
    developer = !!profile && ["developer", "admin"].includes(profile.role);
  return (
    <div className="space-y-6" aria-busy={pending}>
      <div className="flex flex-wrap gap-4">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void reload()}>
          {pending ? copy.loading : copy.reload}
        </Button>
        {developer && (
          <Link href="/settings/developer" className="min-h-10 py-2 text-sm text-accent underline">
            {copy.editProfile}
          </Link>
        )}
        {profile && (
          <Link
            href={`/users/${encodeURIComponent(profile.username)}`}
            className="min-h-10 py-2 text-sm text-accent underline"
          >
            {copy.publicProfile}
          </Link>
        )}
      </div>
      {readError && (
        <p role="alert" className="text-sm text-danger">
          {readError}
        </p>
      )}
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
            disabled={pending || profile.identityVerified || profile.identityPending}
            onClick={() => choose({ type: "user", id: profile.id, name: profile.name })}
          >
            {copy.apply} · {copy.user}
          </Button>
          {developer && (
            <>
              <p className="text-sm text-secondary">
                {copy.developer}:{" "}
                {profile.experienceVerified
                  ? copy.verified
                  : profile.experiencePending
                    ? copy.pending
                    : copy.unverified}
              </p>
              {!profile.hasSpecialties && (
                <p className="text-xs text-muted">{copy.requiresProfile}</p>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={
                  pending ||
                  profile.experienceVerified ||
                  profile.experiencePending ||
                  !profile.hasSpecialties
                }
                onClick={() => choose({ type: "developer", id: profile.id, name: profile.name })}
              >
                {copy.apply} · {copy.developer}
              </Button>
            </>
          )}
        </section>
      )}
      <section className="nexus-panel space-y-4 p-5">
        <h2 className="font-heading text-primary">{copy.manage}</h2>
        <form
          method="GET"
          action="/workspace/verification"
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="view" value={filters.view} />
          <input type="hidden" name="page" value={filters.page} />
          {filters.type && <input type="hidden" name="type" value={filters.type} />}
          <label className="min-w-40 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.query}</span>
            <input
              className={platformFieldClass}
              name="teamsQ"
              defaultValue={teamFilters.query}
              maxLength={100}
            />
          </label>
          <Button type="submit" disabled={pending}>
            {copy.search}
          </Button>
        </form>
        {teams?.items.length === 0 && <p className="text-sm text-muted">{copy.noTeams}</p>}
        <div className="space-y-3">
          {teams?.items.map((team) => (
            <div
              key={team.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base p-3"
            >
              <div className="space-y-1">
                <Link
                  className="text-sm text-accent underline"
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
                disabled={pending || team.pending || team.verified}
                onClick={() => choose({ type: "organization", id: team.id, name: team.name })}
              >
                {copy.choose}
              </Button>
            </div>
          ))}
        </div>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={copy.manage}>
          {teamFilters.page > 1 && (
            <Link
              className="text-accent underline"
              href={href({ teamsPage: teamFilters.page - 1 })}
            >
              {copy.previous}
            </Link>
          )}
          <span className="text-muted">
            {copy.page} {teamFilters.page}
          </span>
          {teams?.hasMore && teamFilters.page < 9999 && (
            <Link
              className="text-accent underline"
              href={href({ teamsPage: teamFilters.page + 1 })}
            >
              {copy.next}
            </Link>
          )}
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
                className="text-sm text-accent underline"
                href={`/workspace/verification?view=pending&type=${target.type}#verification-${encodeURIComponent(savedId)}`}
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
                  className={platformFieldClass}
                  type="url"
                  value={proof}
                  required
                  maxLength={2048}
                  disabled={pending}
                  onChange={(event) => setProof(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm text-secondary">
                <span>{copy.notes}</span>
                <textarea
                  className={platformFieldClass}
                  rows={4}
                  value={notes}
                  required
                  minLength={10}
                  maxLength={1000}
                  disabled={pending}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <Button
                type="submit"
                isLoading={pending}
                disabled={pending || notes.trim().length < 10 || !proof.trim()}
              >
                {copy.submit}
              </Button>
              {writeError && (
                <p role="alert" className="text-sm text-danger">
                  {writeError}
                </p>
              )}
            </form>
          )}
          <button
            type="button"
            className="min-h-9 text-sm text-accent underline"
            disabled={pending}
            onClick={() => setTarget(null)}
          >
            {copy.cancel}
          </button>
        </section>
      )}
      <section className="nexus-panel space-y-3 p-5">
        <p className="text-sm text-muted">{copy.serverHint}</p>
        <Link href="/workspace/servers" className="text-sm text-accent underline">
          {copy.servers}
        </Link>
      </section>
      <section className="space-y-4">
        <nav className="flex gap-3" aria-label={copy.title}>
          {(["pending", "history"] as const).map((view) => (
            <Link
              key={view}
              href={href({ view, page: 1 })}
              aria-current={filters.view === view ? "page" : undefined}
              className="min-h-9 rounded-md border border-base px-3 py-2 text-sm text-accent"
            >
              {copy[view]}
            </Link>
          ))}
        </nav>
        <form
          method="GET"
          action="/workspace/verification"
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="view" value={filters.view} />
          <input type="hidden" name="teamsQ" value={teamFilters.query} />
          <label className="min-w-40 flex-1 space-y-1 text-sm text-secondary">
            <span>{copy.type}</span>
            <select className={platformFieldClass} name="type" defaultValue={filters.type ?? ""}>
              <option value="">{copy.all}</option>
              {VERIFICATION_TYPES.map((type) => (
                <option value={type} key={type}>
                  {type === "organization" ? copy.organization : copy[type]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={pending}>
            {copy.search}
          </Button>
        </form>
        {overview?.history.items.length === 0 && (
          <p className="nexus-panel p-8 text-sm text-muted">{copy.noApplications}</p>
        )}
        {overview?.history.items.map((application) => (
          <article
            key={application.id}
            id={`verification-${application.id}`}
            className="nexus-panel scroll-mt-20 space-y-3 p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="text-sm font-semibold text-primary">{copy[application.targetType]}</h3>
              <span className="text-xs text-secondary">{copy[application.status]}</span>
            </div>
            <p className="break-all text-xs text-muted">{application.targetId}</p>
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">
              {application.notes}
            </p>
            {safeExternalWebUrl(application.proofUrl) && (
              <a
                className="text-sm text-accent underline"
                href={safeExternalWebUrl(application.proofUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.proof}
              </a>
            )}
            {application.reviewNotes && (
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-primary">{copy.reviewNotes}</h4>
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {application.reviewNotes}
                </p>
              </div>
            )}
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
            {application.resolvedAt && (
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
            )}
          </article>
        ))}
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={copy.title}>
          {filters.page > 1 && (
            <Link className="text-accent underline" href={href({ page: filters.page - 1 })}>
              {copy.previous}
            </Link>
          )}
          <span className="text-muted">
            {copy.page} {filters.page}
          </span>
          {overview?.history.hasMore && filters.page < 9999 && (
            <Link className="text-accent underline" href={href({ page: filters.page + 1 })}>
              {copy.next}
            </Link>
          )}
        </nav>
      </section>
    </div>
  );
}
