"use client";
import { Button, ErrorState, Input } from "@nexus/ui";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Locale } from "../../../lib/i18n";
import { platformRequest } from "../../community/user-platform-client";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { linkAccentSm, linkGhostAccentSm } from "../../shell/link-shell";
import { panelClipSpace5P5Sm } from "../../shell/panel-shell";
import { typeFlexWrapGap3, typeSmSuccess } from "../../shell/type-shell";
import {
  developerProfileUpdateSchema,
  type EditableDeveloperProfile,
  editableDeveloperSchema,
} from "../../trust/verification-workspace-contract";
import {
  verificationCopy,
  verificationError,
  verificationMutationError,
} from "../../trust/verification-workspace-copy";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export function DeveloperProfileEditor({
  initial,
  locale,
  actorId,
}: {
  initial: EditableDeveloperProfile | null;
  locale: Locale;
  actorId: string;
}) {
  const copy = verificationCopy(locale),
    [profile, setProfile] = useState(initial);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(getUserPlatformCopy(locale))].includes(text)
      ? text
      : fallback;
  }
  const [specialties, setSpecialties] = useState(initial?.specialties.join("\n") ?? ""),
    [github, setGithub] = useState(initial?.githubUrl ?? ""),
    [discord, setDiscord] = useState(initial?.discordTag ?? "");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(initial ? "" : copy.unavailable),
    [saved, setSaved] = useState(false);
  const guard = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function apply(value: EditableDeveloperProfile) {
    setProfile(value);
    setSpecialties(value.specialties.join("\n"));
    setGithub(value.githubUrl);
    setDiscord(value.discordTag);
  }
  async function reload() {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setError("");
    setSaved(false);
    controller.current = new AbortController();
    try {
      const parsed = editableDeveloperSchema.safeParse(
        await platformRequest(
          "/api/account/developer",
          locale,
          "GET",
          undefined,
          controller.current.signal,
          verificationError,
        ),
      );
      if (
        !parsed.success ||
        parsed.data.id !== actorId ||
        (profile && parsed.data.id !== profile.id)
      )
        throw new Error(copy.unavailable);
      apply(parsed.data);
    } catch (caught) {
      setError(safeMessage(caught, copy.unavailable));
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (guard.current || !profile || profile.id !== actorId) return;
    const parsed = developerProfileUpdateSchema.safeParse({
      specialties: specialties
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean),
      githubUrl: github,
      discordTag: discord,
      expectedUpdatedAt: profile.updatedAt,
      expectedActorId: profile.id,
    });
    if (!parsed.success) {
      setError(copy.invalid);
      return;
    }
    guard.current = true;
    setPending(true);
    setError("");
    setSaved(false);
    controller.current = new AbortController();
    try {
      const response = editableDeveloperSchema.safeParse(
        await platformRequest(
          "/api/account/developer",
          locale,
          "PATCH",
          parsed.data,
          controller.current.signal,
          verificationMutationError,
        ),
      );
      if (
        !response.success ||
        response.data.id !== profile.id ||
        Date.parse(response.data.updatedAt) <= Date.parse(profile.updatedAt) ||
        JSON.stringify(response.data.specialties) !== JSON.stringify(parsed.data.specialties) ||
        response.data.githubUrl !== parsed.data.githubUrl ||
        response.data.discordTag !== parsed.data.discordTag
      )
        throw new Error(copy.mutationUnavailable);
      apply(response.data);
      setSaved(true);
    } catch (caught) {
      setError(safeMessage(caught, copy.mutationUnavailable));
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  return (
    <div className={panelClipSpace5P5Sm} aria-busy={pending}>
      <p className="text-sm text-muted">{copy.invalidation}</p>
      <p className="text-xs text-muted">{copy.pendingChange}</p>
      {profile?.verifiedDeveloper && (
        <p className="text-sm font-semibold text-success">{copy.experience}</p>
      )}
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <label htmlFor="developer-specialties" className={nativeLabelClass}>
            {copy.specialties}
          </label>
          <textarea
            id="developer-specialties"
            rows={5}
            value={specialties}
            maxLength={700}
            disabled={pending || !profile}
            onChange={(event) => setSpecialties(event.target.value)}
            className={textareaClass}
          />
        </div>
        <Input
          id="developer-github"
          type="url"
          label={copy.github}
          value={github}
          maxLength={2048}
          disabled={pending || !profile}
          onChange={(event) => setGithub(event.target.value)}
        />
        <Input
          id="developer-discord"
          label={copy.discord}
          value={discord}
          maxLength={80}
          disabled={pending || !profile}
          onChange={(event) => setDiscord(event.target.value)}
        />
        <div className={typeFlexWrapGap3}>
          <Button
            type="submit"
            isLoading={pending}
            disabled={!profile || pending}
            className="min-h-11"
          >
            {copy.save}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="min-h-11"
            onClick={() => void reload()}
          >
            {copy.reload}
          </Button>
        </div>
      </form>
      {error ? (
        <ErrorState
          title={error}
          description={copy.unavailableHint}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              className={linkGhostAccentSm}
              onClick={() => void reload()}
            >
              {copy.reload}
            </Button>
          }
        />
      ) : null}
      {saved && (
        <p role="status" className={typeSmSuccess}>
          {copy.saved}
        </p>
      )}
      <Link href="/workspace/verification" className={linkAccentSm}>
        {copy.back}
      </Link>
    </div>
  );
}
