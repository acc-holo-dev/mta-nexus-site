"use client";
import { Button, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import {
  confirmedPrivacyUpdate,
  type EditablePrivacy,
  parseEditablePrivacy,
} from "../lib/profile-privacy-contract";
import {
  profilePrivacyCopy,
  profilePrivacyError,
  profilePrivacyMutationError,
} from "../lib/profile-privacy-copy";
import { PlatformRequestError, platformRequest } from "../lib/user-platform-client";
import { actionConfirmCheckboxFocusClass } from "./action-confirm-checkbox";

const retryButtonClass =
  "h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function ProfilePrivacyEditor({
  initial,
  locale,
}: {
  initial: EditablePrivacy | null;
  locale: Locale;
}) {
  const copy = profilePrivacyCopy(locale),
    router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [activity, setActivity] = useState(initial?.showActivity ?? true);
  const [contacts, setContacts] = useState(initial?.showProfessionalContacts ?? true);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    initial ? null : { text: copy.unavailable, error: true },
  );
  const guard = useRef(false),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function apply(saved: EditablePrivacy) {
    setProfile(saved);
    setActivity(saved.showActivity);
    setContacts(saved.showProfessionalContacts);
  }

  async function fetchPreferences(signal: AbortSignal) {
    const response = await platformRequest(
      "/api/account/privacy",
      locale,
      "GET",
      undefined,
      signal,
      profilePrivacyError,
    );
    const saved = parseEditablePrivacy(response.preferences);
    if (!saved || (profile && (saved.id !== profile.id || saved.username !== profile.username)))
      throw new Error(copy.unavailable);
    return saved;
  }

  async function loadPreferences(mode: "replace" | "revision") {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setNotice(null);
    const requestController = new AbortController();
    controller.current = requestController;
    try {
      const saved = await fetchPreferences(requestController.signal);
      if (requestController.signal.aborted) return;
      if (mode === "replace") apply(saved);
      else
        setProfile((current) =>
          current
            ? { ...current, updatedAt: saved.updatedAt }
            : { ...saved, showActivity: activity, showProfessionalContacts: contacts },
        );
    } catch (error) {
      if (!requestController.signal.aborted)
        setNotice({ text: error instanceof Error ? error.message : copy.unavailable, error: true });
    } finally {
      guard.current = false;
      if (!requestController.signal.aborted) setPending(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (guard.current || !profile) return;
    guard.current = true;
    setPending(true);
    setNotice(null);
    const fields = { showActivity: activity, showProfessionalContacts: contacts };
    const requestController = new AbortController();
    controller.current = requestController;
    try {
      const response = await platformRequest(
        "/api/account/privacy",
        locale,
        "PATCH",
        {
          ...fields,
          expectedActorId: profile.id,
          expectedUpdatedAt: profile.updatedAt,
        },
        requestController.signal,
        profilePrivacyMutationError,
      );
      const saved = confirmedPrivacyUpdate(response, profile, fields);
      if (!saved) throw new Error(copy.unconfirmed);
      if (!requestController.signal.aborted) {
        apply(saved);
        setNotice({ text: copy.saved, error: false });
        router.refresh();
      }
    } catch (error) {
      if (requestController.signal.aborted) return;
      if (error instanceof PlatformRequestError && error.code === "ACCOUNT_CHANGED") {
        setProfile(null);
        setActivity(true);
        setContacts(true);
        setNotice({ text: error.message, error: true });
        return;
      }
      const text = error instanceof Error ? error.message : copy.uncertain;
      setNotice({ text, error: true });
      if (text === copy.conflict) {
        try {
          const saved = await fetchPreferences(requestController.signal);
          if (!requestController.signal.aborted)
            setProfile((current) =>
              current
                ? { ...current, updatedAt: saved.updatedAt }
                : { ...saved, showActivity: activity, showProfessionalContacts: contacts },
            );
        } catch {
          // Keep conflict notice; local toggle choices remain selected.
        }
      }
    } finally {
      guard.current = false;
      if (!requestController.signal.aborted) setPending(false);
    }
  }

  return (
    <section
      className="nexus-panel min-w-0 space-y-5 overflow-x-clip p-5 sm:p-6"
      aria-busy={pending ? true : undefined}
      aria-label={copy.title}
    >
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={pending || !profile} className="space-y-5">
          <legend className="sr-only">{copy.title}</legend>
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="showActivity"
              checked={activity}
              onChange={(event) => setActivity(event.target.checked)}
              aria-describedby="privacy-activity-description"
              className={`mt-1 h-5 w-5 shrink-0 accent-[var(--nexus-accent)] ${actionConfirmCheckboxFocusClass}`}
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-primary">{copy.activity}</span>
              <span id="privacy-activity-description" className="block text-sm text-muted">
                {copy.activityDescription}
              </span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              name="showProfessionalContacts"
              checked={contacts}
              onChange={(event) => setContacts(event.target.checked)}
              aria-describedby="privacy-contacts-description"
              className={`mt-1 h-5 w-5 shrink-0 accent-[var(--nexus-accent)] ${actionConfirmCheckboxFocusClass}`}
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-primary">{copy.contacts}</span>
              <span id="privacy-contacts-description" className="block text-sm text-muted">
                {copy.contactsDescription}
              </span>
            </span>
          </label>
        </fieldset>
        <p className="text-sm text-muted">{copy.scope}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            isLoading={pending}
            disabled={pending || !profile}
            className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.save}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !profile}
            className="min-h-11"
            onClick={() => void loadPreferences("revision")}
            aria-describedby="privacy-refresh-description"
          >
            {copy.refreshVersion}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="min-h-11"
            onClick={() => void loadPreferences("replace")}
            aria-describedby="privacy-reload-description"
          >
            {copy.reload}
          </Button>
        </div>
        <p id="privacy-refresh-description" className="text-xs text-muted">
          {copy.refreshVersionHint}
        </p>
        <p id="privacy-reload-description" className="text-xs text-muted">
          {copy.reloadHint}
        </p>
      </form>
      {pending && (
        <p role="status" className="text-sm text-muted">
          {copy.loading}
        </p>
      )}
      {notice?.error ? (
        <ErrorState
          id="profile-privacy-notice-unavailable"
          title={notice.text}
          action={
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              className={retryButtonClass}
              onClick={() => void loadPreferences("replace")}
            >
              {copy.reload}
            </Button>
          }
        />
      ) : notice ? (
        <p role="status" className="text-sm text-success">
          {notice.text}
        </p>
      ) : null}
      {profile && (
        <section
          className="min-w-0 space-y-3 overflow-x-clip rounded-lg border border-base p-4"
          aria-label={copy.guestPreview}
        >
          <h2 className="text-sm font-semibold text-primary">{copy.guestPreview}</h2>
          <p className="text-sm text-muted">{copy.guestPreviewNote}</p>
          <ul className="space-y-1 text-sm text-secondary">
            <li>{activity ? copy.guestPreviewActivityOn : copy.guestPreviewActivityOff}</li>
            <li>{contacts ? copy.guestPreviewContactsOn : copy.guestPreviewContactsOff}</li>
            <li>{copy.guestPreviewAlways}</li>
          </ul>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/users/${encodeURIComponent(profile.username)}?preview=guest`}
              className={navLinkClass}
            >
              {copy.openGuestPreview}
            </Link>
            <Link href={`/users/${encodeURIComponent(profile.username)}`} className={navLinkClass}>
              {copy.publicProfile}
            </Link>
          </div>
        </section>
      )}
    </section>
  );
}
