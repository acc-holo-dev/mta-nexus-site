"use client";
import { Avatar, Button, ErrorState, Input } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  PlatformRequestError,
  parseEditableProfile,
  platformRequest,
} from "../../community/user-platform-client";
import type { EditableProfile } from "../../community/user-platform-contract";
import { getUserPlatformCopy, userPlatformError } from "../../community/user-platform-copy";
import { linkAccentTightSm } from "../../shell/link-shell";
import { useNexusLocale } from "../../shell/locale";
import { panelSpace4P5Shadow } from "../../shell/panel-shell";
import { surfaceSpace2P4 } from "../../shell/surface-shell";
import {
  typeFlexCenterGap3,
  typePrewrapBreak,
  typeSmSemiboldPrimary,
  typeSmSuccess,
} from "../../shell/type-shell";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export function PublicProfileForm() {
  const { locale, dictionary } = useNexusLocale();
  const copy = getUserPlatformCopy(locale);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return Object.values(copy).includes(text) ? text : fallback;
  }
  const router = useRouter();
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<EditableProfile | null>(null);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const pending = useRef(false);
  const loadedIdentity = useRef<{ id: string; username: string } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly retries the initial read; later checks keep the draft.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotice(null);
    void platformRequest("/api/account/profile", locale, "GET", undefined, controller.signal)
      .then((data) => {
        const loaded = parseEditableProfile(data.profile);
        if (!loaded) throw new Error(userPlatformError(locale, "UNCONFIRMED"));
        if (controller.signal.aborted) return;
        if (
          loadedIdentity.current &&
          (loadedIdentity.current.id !== loaded.id ||
            loadedIdentity.current.username !== loaded.username)
        ) {
          loadedIdentity.current = null;
          setProfile(null);
          setLatest(null);
          setRecoveryRequired(false);
          setNotice({ text: copy.profileAccountChanged, error: true });
          return;
        }
        loadedIdentity.current = { id: loaded.id, username: loaded.username };
        setProfile(loaded);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setNotice({
            text: safeMessage(error, copy.unavailable),
            error: true,
          });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || pending.current || loading || recoveryRequired || latest) return;
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
        expectedActorId: profile.id,
        expectedUpdatedAt: profile.updatedAt,
      });
      const saved = parseEditableProfile(data.profile);
      if (saved && (saved.id !== profile.id || saved.username !== profile.username)) {
        loadedIdentity.current = null;
        setProfile(null);
        setLatest(null);
        setRecoveryRequired(false);
        setNotice({ text: copy.profileAccountChanged, error: true });
        return;
      }
      if (
        data.success !== true ||
        !saved ||
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
      if (error instanceof PlatformRequestError && error.code === "ACCOUNT_CHANGED") {
        loadedIdentity.current = null;
        setProfile(null);
        setLatest(null);
        setRecoveryRequired(false);
        setNotice({ text: copy.profileAccountChanged, error: true });
        return;
      }
      setNotice({ text: safeMessage(error, copy.unavailable), error: true });
      setRecoveryRequired(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function checkSavedProfile() {
    if (!profile || pending.current || loading) return;
    pending.current = true;
    setLoading(true);
    setLatest(null);
    try {
      const data = await platformRequest("/api/account/profile", locale, "GET");
      const next = parseEditableProfile(data.profile);
      if (!next) throw new Error(userPlatformError(locale, "UNCONFIRMED"));
      if (next.id !== profile.id || next.username !== profile.username) {
        loadedIdentity.current = null;
        setProfile(null);
        setRecoveryRequired(false);
        setNotice({ text: copy.profileAccountChanged, error: true });
        return;
      }
      if (Date.parse(next.updatedAt) < Date.parse(profile.updatedAt))
        throw new Error(userPlatformError(locale, "UNCONFIRMED"));
      setLatest(next);
      setNotice(null);
    } catch (error) {
      setNotice({ text: safeMessage(error, copy.unavailable), error: true });
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  return (
    <section aria-labelledby="public-profile-heading" className={panelSpace4P5Shadow}>
      <h2 id="public-profile-heading" className={typeSmSemiboldPrimary}>
        {copy.profile}
      </h2>
      <p className="text-xs text-muted">{copy.profileDescription}</p>
      {loading && (
        <p role="status" aria-live="polite" aria-busy={true} className="text-sm text-muted">
          {copy.loading}
        </p>
      )}
      {notice?.error ? (
        <ErrorState
          title={notice.text}
          description={
            recoveryRequired
              ? dictionary.errors.formErrorHint
              : notice.text === copy.profileAccountChanged
                ? copy.profileAccountChangedHint
                : copy.unavailableHint
          }
        />
      ) : null}
      {notice && !notice.error ? (
        <p role="status" className={typeSmSuccess}>
          {notice.text}
        </p>
      ) : null}
      {profile && (
        <form key={profile.id} onSubmit={save} aria-busy={busy || loading} className="space-y-4">
          <div className={typeFlexCenterGap3}>
            <Avatar
              src={profile.avatarUrl || undefined}
              alt={profile.displayName}
              fallback={profile.displayName}
            />
            <Link
              href={`/users/${encodeURIComponent(profile.username)}`}
              className={linkAccentTightSm}
            >
              {copy.profileLink}
            </Link>
          </div>
          <fieldset disabled={busy || loading} className="space-y-4">
            <Input
              id="profile-display-name"
              name="displayName"
              label={copy.displayName}
              autoComplete="nickname"
              required
              minLength={2}
              maxLength={80}
              defaultValue={profile.displayName}
            />
            <div className="space-y-1.5">
              <label htmlFor="profile-bio" className={nativeLabelClass}>
                {copy.bio}
              </label>
              <textarea
                id="profile-bio"
                name="bio"
                maxLength={2000}
                rows={5}
                defaultValue={profile.bio}
                className={textareaClass}
              />
            </div>
            <Input
              id="profile-avatar-url"
              name="avatarUrl"
              type="url"
              label={copy.avatar}
              maxLength={2048}
              defaultValue={profile.avatarUrl}
            />
            <Button
              type="submit"
              isLoading={busy}
              disabled={recoveryRequired || Boolean(latest)}
              className="min-h-11"
            >
              {copy.save}
            </Button>
          </fieldset>
        </form>
      )}
      {profile && recoveryRequired && (
        <p className="text-sm text-muted">{copy.profileRecoveryHelp}</p>
      )}
      {profile && latest && (
        <section className={surfaceSpace2P4} aria-label={copy.profileLatest}>
          <h3 className="font-semibold">{copy.profileLatest}</h3>
          <p className="text-sm text-muted">{copy.profileCompareHelp}</p>
          <p className="break-words">
            {copy.displayName}: {latest.displayName}
          </p>
          <p className={typePrewrapBreak}>
            {copy.bio}: {latest.bio}
          </p>
          <p className="break-words">
            {copy.avatar}: {latest.avatarUrl}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy || loading}
            onClick={() => {
              setProfile(latest);
              setLatest(null);
              setRecoveryRequired(false);
              setNotice(null);
            }}
          >
            {copy.profileUseLatest}
          </Button>
        </section>
      )}
      {(notice?.error || (!profile && !loading)) && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy || loading}
          onClick={() => (profile ? void checkSavedProfile() : setRevision((value) => value + 1))}
        >
          {profile ? copy.profileCompare : copy.retry}
        </Button>
      )}
    </section>
  );
}
