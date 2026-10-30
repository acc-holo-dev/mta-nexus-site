"use client";
import { Button, Input } from "@nexus/ui";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { platformRequest } from "../lib/user-platform-client";
import {
  developerProfileUpdateSchema,
  type EditableDeveloperProfile,
  editableDeveloperSchema,
} from "../lib/verification-workspace-contract";
import {
  verificationCopy,
  verificationError,
  verificationMutationError,
} from "../lib/verification-workspace-copy";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";
export function DeveloperProfileEditor({
  initial,
  locale,
}: {
  initial: EditableDeveloperProfile | null;
  locale: Locale;
}) {
  const copy = verificationCopy(locale),
    [profile, setProfile] = useState(initial);
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
      if (!parsed.success || (profile && parsed.data.id !== profile.id))
        throw new Error(copy.unavailable);
      apply(parsed.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.unavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (guard.current || !profile) return;
    const parsed = developerProfileUpdateSchema.safeParse({
      specialties: specialties
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean),
      githubUrl: github,
      discordTag: discord,
      expectedUpdatedAt: profile.updatedAt,
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
      setError(caught instanceof Error ? caught.message : copy.mutationUnavailable);
    } finally {
      guard.current = false;
      setPending(false);
    }
  }
  return (
    <div className="nexus-panel space-y-5 p-5 sm:p-6" aria-busy={pending}>
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
        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={pending} disabled={!profile || pending}>
            {copy.save}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void reload()}
          >
            {copy.reload}
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      )}
      <Link href="/workspace/verification" className="text-sm text-accent underline">
        {copy.back}
      </Link>
    </div>
  );
}
