"use client";

import { Button, Field } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import {
  buildCommunityTopicSubmission,
  communityTopicRequest,
  confirmedCommunityTopicPath,
} from "../lib/community-topic-submission";
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

export function CommunityTopicForm() {
  const router = useRouter();
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.community;
  const formErrorId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const submission = buildCommunityTopicSubmission({
      title: String(data.get("title") || ""),
      body: String(data.get("body") || ""),
      type: String(data.get("type") || "question"),
      tags: String(data.get("tags") || ""),
    });
    if (!submission) {
      setError(copy.createError);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/content",
        communityTopicRequest(submission, AbortSignal.timeout(15_000)),
      );
      const payload = await response.json().catch(() => null);
      const path = confirmedCommunityTopicPath(response.status, payload);
      if (!path) {
        setError(communityTopicErrorMessage(payload, response.status, copy.createError, locale));
        setBusy(false);
        return;
      }
      router.push(path);
      router.refresh();
    } catch (caught) {
      const timedOut =
        caught instanceof DOMException && caught.name === "TimeoutError"
          ? communityTopicErrorMessage({ code: "REQUEST_TIMEOUT" }, 0, copy.createError, locale)
          : null;
      setError(timedOut ?? copy.createError);
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-busy={busy}
      aria-describedby={error ? formErrorId : undefined}
      className="nexus-panel grid gap-4 p-5 shadow-nexus-sm sm:p-6"
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
            disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
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
            disabled={busy}
            aria-describedby={control.describedBy}
            className={control.className}
          />
        )}
      </Field>

      {error && (
        <p id={formErrorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <Button type="submit" isLoading={busy} disabled={busy}>
        {busy ? copy.publishing : copy.publish}
      </Button>
    </form>
  );
}
