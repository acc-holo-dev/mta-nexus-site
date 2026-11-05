"use client";

import { Button, ErrorState, Field } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  type CommunityTopicIntent,
  clearCommunityTopicIntent,
  readCommunityTopicIntent,
  writeCommunityTopicIntent,
} from "../lib/community-topic-intent";
import {
  buildCommunityTopicSubmission,
  type CommunityTopicSubmission,
  communityTopicRequest,
  confirmedCommunityTopicPath,
} from "../lib/community-topic-submission";
import { privateApiRequest } from "../lib/private-api-request";
import { authEntryHref } from "./auth-return-path";
import { useNexusLocale } from "./locale-context";

function communityTopicErrorMessage(
  payload: unknown,
  status: number,
  fallback: string,
  locale: "ru" | "en",
): string {
  const codes: Record<string, { ru: string; en: string }> = {
    VALIDATION_ERROR: {
      ru: "Проверьте заголовок, текст и теги и попробуйте снова.",
      en: "Check the title, message, and tags, then try again.",
    },
    FORBIDDEN: {
      ru: "Недостаточно прав, чтобы создать тему.",
      en: "You do not have permission to create a topic.",
    },
    CONFLICT: {
      ru: "Такая тема уже существует. Измените заголовок и повторите.",
      en: "A similar topic already exists. Change the title and retry.",
    },
    RATE_LIMITED: {
      ru: "Слишком много попыток. Подождите и повторите.",
      en: "Too many attempts. Wait a moment and retry.",
    },
    REQUEST_TIMEOUT: {
      ru: "Сервер не подтвердил публикацию вовремя. Тема могла не создаться — проверьте список и повторите при необходимости.",
      en: "The server did not confirm publication in time. The topic may not exist yet — check the list and retry if needed.",
    },
  };

  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const code = typeof record?.code === "string" ? record.code : "";
  if (code && codes[code]) return codes[code][locale];
  if (status === 401) {
    return locale === "ru" ? "Войдите, чтобы опубликовать тему." : "Sign in to publish a topic.";
  }
  if (status === 403) return codes.FORBIDDEN[locale];
  if (status === 404) {
    return locale === "ru" ? "Связанный сервер не найден." : "The linked server was not found.";
  }
  if (status === 400) return codes.VALIDATION_ERROR[locale];
  if (status === 429) return codes.RATE_LIMITED[locale];
  return fallback;
}

export function CommunityTopicForm({ actorId = null }: { actorId?: string | null }) {
  const router = useRouter();
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.community;
  const formErrorId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<CommunityTopicIntent | null>(null);
  const [restoring, setRestoring] = useState(Boolean(actorId));
  const [identityVerified, setIdentityVerified] = useState(!actorId);
  const [foreignActor, setForeignActor] = useState(false);
  const [occupiedId, setOccupiedId] = useState<string | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const clearOnUnmount = useRef(false);
  const pendingRef = useRef<CommunityTopicIntent | null>(null);
  const identityRef = useRef(!actorId);
  const foreignRef = useRef(false);
  const occupiedRef = useRef(false);
  async function verifyIdentity() {
    if (!actorId || lock.current) return;
    lock.current = true;
    setRestoring(true);
    try {
      const response = await fetch("/api/auth/session", privateApiRequest());
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (!response.ok || data?.authenticated !== true || typeof data?.user?.id !== "string")
        throw new Error(copy.topicIdentityError);
      if (data.user.id !== actorId) {
        foreignRef.current = true;
        setForeignActor(true);
        setError(copy.topicActorChanged);
        return;
      }
      const stored = readCommunityTopicIntent(actorId);
      if (!stored.available || (pendingRef.current && !stored.intent))
        throw new Error(copy.topicStorageError);
      identityRef.current = true;
      setIdentityVerified(true);
      if (stored.intent) {
        pendingRef.current = stored.intent;
        setPending(stored.intent);
        const form = formRef.current;
        if (form) {
          for (const key of ["title", "body", "type", "tags"] as const) {
            const input = form.elements.namedItem(key);
            if (
              input instanceof HTMLInputElement ||
              input instanceof HTMLTextAreaElement ||
              input instanceof HTMLSelectElement
            )
              input.value = stored.intent.draft[key];
          }
        }
        setRecoveryNotice(copy.topicPending);
      }
      setError(null);
    } catch (caught) {
      if (alive.current)
        setError(caught instanceof Error ? caught.message : copy.topicIdentityError);
    } finally {
      lock.current = false;
      if (alive.current) setRestoring(false);
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies(verifyIdentity): The keyed form verifies once per actor.
  useEffect(() => {
    alive.current = true;
    if (actorId) void verifyIdentity();
    return () => {
      alive.current = false;
      if (actorId && clearOnUnmount.current) clearCommunityTopicIntent(actorId);
    };
  }, [actorId]);

  async function checkSaved() {
    const current = pendingRef.current;
    if (!current || !actorId || lock.current || foreignRef.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const headers = new Headers();
      headers.set("X-Nexus-Actor-Id", actorId);
      const response = await fetch(
        `/api/content/recovery?slug=${encodeURIComponent(current.submission.slug)}`,
        { ...privateApiRequest(), headers },
      );
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (data?.code === "ACTOR_CHANGED") {
        foreignRef.current = true;
        setForeignActor(true);
        setError(copy.topicActorChanged);
        return;
      }
      if (response.status === 401) {
        identityRef.current = false;
        setIdentityVerified(false);
        setError(copy.topicIdentityError);
        return;
      }
      if (!response.ok || !data || !(data.content === null || typeof data.content === "object"))
        throw new Error(copy.createError);
      if (data.content === null) {
        setRecoveryNotice(copy.topicNotFound);
        return;
      }
      const saved = data.content;
      if (
        typeof saved.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,128}$/u.test(saved.id) ||
        saved.slug !== current.submission.slug
      )
        throw new Error(copy.createError);
      const exact =
        saved.title === current.submission.title &&
        saved.body === current.submission.body &&
        saved.type === current.submission.type &&
        JSON.stringify(saved.tags) === JSON.stringify(current.submission.tags);
      if (exact && saved.status === "published") {
        clearOnUnmount.current = true;
        router.push(`/articles/${encodeURIComponent(saved.slug)}`);
        router.refresh();
        return;
      }
      occupiedRef.current = true;
      setOccupiedId(saved.id);
      setRecoveryNotice(copy.topicExisting);
    } catch {
      if (alive.current) setError(copy.createError);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || busy || restoring || foreignRef.current || occupiedRef.current) return;
    if (!actorId || !identityRef.current) {
      setError(communityTopicErrorMessage(null, 401, copy.createError, locale));
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const draft = {
      title: String(data.get("title") || ""),
      body: String(data.get("body") || ""),
      type: String(data.get("type") || "question"),
      tags: String(data.get("tags") || ""),
    };
    const current = pendingRef.current;
    const retryingPending = Boolean(current);
    let submission: CommunityTopicSubmission | null;
    try {
      submission = current?.submission ?? buildCommunityTopicSubmission(draft);
    } catch {
      setError(copy.topicStorageError);
      return;
    }
    if (!submission) {
      setError(copy.createError);
      return;
    }

    const intent = current ?? { actorId, submission, draft: { ...draft, type: submission.type } };
    if (!writeCommunityTopicIntent(intent)) {
      setError(copy.topicStorageError);
      return;
    }
    pendingRef.current = intent;
    setPending(intent);
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/content",
        communityTopicRequest(submission, AbortSignal.timeout(15_000), actorId),
      );
      const payload = await response.json().catch(() => null);
      if (!alive.current) return;
      if (payload?.code === "ACTOR_CHANGED") {
        foreignRef.current = true;
        setForeignActor(true);
        setError(copy.topicActorChanged);
        return;
      }
      if (response.status === 401) {
        identityRef.current = false;
        setIdentityVerified(false);
        setError(copy.topicIdentityError);
        return;
      }
      const path = confirmedCommunityTopicPath(response.status, payload, submission.slug);
      if (!path) {
        if (
          !retryingPending &&
          [400, 413, 415, 429].includes(response.status) &&
          clearCommunityTopicIntent(actorId)
        ) {
          pendingRef.current = null;
          setPending(null);
        }
        setError(communityTopicErrorMessage(payload, response.status, copy.createError, locale));
        setRecoveryNotice(copy.topicPending);
        return;
      }
      clearOnUnmount.current = true;
      router.push(path);
      router.refresh();
    } catch (caught) {
      const timedOut =
        caught instanceof DOMException && caught.name === "TimeoutError"
          ? communityTopicErrorMessage({ code: "REQUEST_TIMEOUT" }, 0, copy.createError, locale)
          : null;
      if (alive.current) {
        setError(timedOut ?? copy.createError);
        setRecoveryNotice(copy.topicPending);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <>
      {(!identityVerified || foreignActor) && error && (
        <ErrorState title={error} description={copy.createErrorDescription} />
      )}
      {(!actorId || !identityVerified || foreignActor) && (
        <div className="space-y-1">
          {!actorId && <p className="text-sm text-muted">{copy.topicGuestDraft}</p>}
          <Link
            href={authEntryHref("login", "/community/new")}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.topicSignIn}
          </Link>
        </div>
      )}
      {!foreignActor && actorId && !identityVerified && !restoring && (
        <Button type="button" variant="outline" onClick={() => void verifyIdentity()}>
          {copy.topicIdentity}
        </Button>
      )}
      <form
        ref={formRef}
        style={foreignActor || !identityVerified ? { display: "none" } : undefined}
        onSubmit={submit}
        aria-busy={busy}
        aria-describedby={error ? formErrorId : undefined}
        className="nexus-panel grid min-w-0 gap-4 overflow-x-clip p-5 shadow-nexus-sm sm:p-6"
      >
        {busy && (
          <p role="status" className="text-xs text-muted">
            {copy.publishing}
          </p>
        )}

        <Field id="community-topic-type" label={copy.type} pending={busy}>
          {(control) => (
            <select
              id={control.id}
              name="type"
              disabled={busy || restoring || Boolean(pending)}
              aria-describedby={control.describedBy}
              className={control.className}
              defaultValue="question"
            >
              <option value="question">{copy.question}</option>
              <option value="post">{copy.discussion}</option>
            </select>
          )}
        </Field>

        <Field id="community-topic-title" label={copy.topicTitle} pending={busy}>
          {(control) => (
            <input
              id={control.id}
              name="title"
              minLength={3}
              maxLength={200}
              required
              disabled={busy || restoring}
              readOnly={Boolean(pending)}
              aria-describedby={control.describedBy}
              aria-invalid={control.invalid}
              className={control.className}
            />
          )}
        </Field>

        <Field id="community-topic-body" label={copy.message} pending={busy}>
          {(control) => (
            <textarea
              id={control.id}
              name="body"
              minLength={10}
              maxLength={20_000}
              rows={10}
              required
              disabled={busy || restoring}
              readOnly={Boolean(pending)}
              aria-describedby={control.describedBy}
              className={`${control.className} h-auto min-h-28`}
            />
          )}
        </Field>

        <Field id="community-topic-tags" label={copy.tags} pending={busy}>
          {(control) => (
            <input
              id={control.id}
              name="tags"
              maxLength={500}
              disabled={busy || restoring}
              readOnly={Boolean(pending)}
              aria-describedby={control.describedBy}
              className={control.className}
            />
          )}
        </Field>

        {error ? (
          <div id={formErrorId}>
            <ErrorState title={error} description={copy.createErrorDescription} />
          </div>
        ) : null}

        {pending && (
          <p role="status" className="text-sm text-secondary">
            {recoveryNotice || copy.topicPending}
          </p>
        )}
        {pending && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void checkSaved()}>
            {copy.topicCheck}
          </Button>
        )}
        {occupiedId && (
          <Link
            href={`/workspace/content/${encodeURIComponent(occupiedId)}`}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.topicOpenSaved}
          </Link>
        )}
        <Button
          type="submit"
          isLoading={busy}
          disabled={busy || restoring || Boolean(occupiedId)}
          className="min-h-11"
        >
          {busy ? copy.publishing : pending ? copy.topicRetry : copy.publish}
        </Button>
      </form>
    </>
  );
}
