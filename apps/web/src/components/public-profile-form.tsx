"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Avatar } from "@nexus/ui";
import { useNexusLocale } from "./locale-context";
import { getUserPlatformCopy, userPlatformError } from "../lib/user-platform-copy";
import {
  parseEditableProfile,
  platformRequest,
  platformFieldClass,
} from "../lib/user-platform-client";
import type { EditableProfile } from "../lib/user-platform-contract";

export function PublicProfileForm() {
  const { locale } = useNexusLocale();
  const copy = getUserPlatformCopy(locale);
  const router = useRouter();
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly reloads the saved profile after a conflict or read failure.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotice(null);
    void platformRequest("/api/account/profile", locale, "GET", undefined, controller.signal)
      .then((data) => {
        const loaded = parseEditableProfile(data.profile);
        if (!loaded) throw new Error(userPlatformError(locale, "UNCONFIRMED"));
        if (!controller.signal.aborted) setProfile(loaded);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setNotice({
            text: error instanceof Error ? error.message : copy.unavailable,
            error: true,
          });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [locale, revision, copy.unavailable]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || pending.current || loading) return;
    const form = new FormData(event.currentTarget);
    const fields = {
      displayName: String(form.get("displayName") ?? "").trim(),
      bio: String(form.get("bio") ?? "").trim(),
      avatarUrl: String(form.get("avatarUrl") ?? "").trim(),
    };
    pending.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const data = await platformRequest("/api/account/profile", locale, "PATCH", {
        ...fields,
        expectedUpdatedAt: profile.updatedAt,
      });
      const saved = parseEditableProfile(data.profile);
      if (
        data.success !== true ||
        !saved ||
        saved.id !== profile.id ||
        saved.username !== profile.username ||
        saved.displayName !== fields.displayName ||
        saved.bio !== fields.bio ||
        saved.avatarUrl !== fields.avatarUrl ||
        Date.parse(saved.updatedAt) <= Date.parse(profile.updatedAt)
      )
        throw new Error(userPlatformError(locale, "UNCONFIRMED"));
      setProfile(saved);
      setNotice({ text: copy.saved, error: false });
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.unavailable, error: true });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="public-profile-heading"
      className="nexus-panel space-y-4 p-5 shadow-nexus-sm"
    >
      <h2 id="public-profile-heading" className="text-sm font-semibold text-primary">
        {copy.profile}
      </h2>
      <p className="text-xs text-muted">{copy.profileDescription}</p>
      {loading && (
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      )}
      {notice && (
        <p
          role={notice.error ? "alert" : "status"}
          className={`text-sm ${notice.error ? "text-danger" : "text-success"}`}
        >
          {notice.text}
        </p>
      )}
      {profile && (
        <form key={profile.updatedAt} onSubmit={save} aria-busy={busy} className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={profile.avatarUrl || undefined}
              alt={profile.displayName}
              fallback={profile.displayName}
            />
            <Link
              href={`/users/${encodeURIComponent(profile.username)}`}
              className="text-sm text-accent underline"
            >
              {copy.profileLink}
            </Link>
          </div>
          <fieldset disabled={busy || loading} className="space-y-4">
            <label className="block space-y-1 text-sm text-secondary">
              <span>{copy.displayName}</span>
              <input
                name="displayName"
                autoComplete="nickname"
                required
                minLength={2}
                maxLength={80}
                defaultValue={profile.displayName}
                className={platformFieldClass}
              />
            </label>
            <label className="block space-y-1 text-sm text-secondary">
              <span>{copy.bio}</span>
              <textarea
                name="bio"
                maxLength={2000}
                rows={5}
                defaultValue={profile.bio}
                className={platformFieldClass}
              />
            </label>
            <label className="block space-y-1 text-sm text-secondary">
              <span>{copy.avatar}</span>
              <input
                name="avatarUrl"
                type="url"
                maxLength={2048}
                defaultValue={profile.avatarUrl}
                className={platformFieldClass}
              />
            </label>
            <Button type="submit" isLoading={busy}>
              {copy.save}
            </Button>
          </fieldset>
        </form>
      )}
      {(notice?.error || (!profile && !loading)) && (
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => setRevision((value) => value + 1)}
          className="text-sm text-accent underline"
        >
          {copy.retry}
        </button>
      )}
    </section>
  );
}
