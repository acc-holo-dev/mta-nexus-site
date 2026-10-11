"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@nexus/ui";
import type { Locale } from "../lib/i18n";
import {
  confirmedPrivacyUpdate,
  parseEditablePrivacy,
  type EditablePrivacy,
} from "../lib/profile-privacy-contract";
import {
  profilePrivacyCopy,
  profilePrivacyError,
  profilePrivacyMutationError,
} from "../lib/profile-privacy-copy";
import { platformRequest } from "../lib/user-platform-client";

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
  async function reload() {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setNotice(null);
    const requestController = new AbortController();
    controller.current = requestController;
    try {
      const response = await platformRequest(
        "/api/account/privacy",
        locale,
        "GET",
        undefined,
        requestController.signal,
        profilePrivacyError,
      );
      const saved = parseEditablePrivacy(response.preferences);
      if (!saved || (profile && (saved.id !== profile.id || saved.username !== profile.username)))
        throw new Error(copy.unavailable);
      if (!requestController.signal.aborted) apply(saved);
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
      if (!requestController.signal.aborted)
        setNotice({ text: error instanceof Error ? error.message : copy.uncertain, error: true });
    } finally {
      guard.current = false;
      if (!requestController.signal.aborted) setPending(false);
    }
  }

  return (
    <section
      className="nexus-panel space-y-5 p-5 sm:p-6"
      aria-busy={pending}
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
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--nexus-accent)]"
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
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--nexus-accent)]"
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
          <Button type="submit" isLoading={pending} disabled={pending || !profile}>
            {copy.save}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void reload()}
            aria-describedby="privacy-reload-description"
          >
            {copy.reload}
          </Button>
        </div>
        <p id="privacy-reload-description" className="text-xs text-muted">
          {copy.reloadHint}
        </p>
      </form>
      {pending && (
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
        <Link
          href={`/users/${encodeURIComponent(profile.username)}`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.publicProfile}
        </Link>
      )}
    </section>
  );
}
