"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nexus/ui";
import { useNexusLocale } from "./locale-context";
import {
  buildCommunityTopicSubmission,
  communityTopicRequest,
  confirmedCommunityTopicPath,
} from "../lib/community-topic-submission";

const fieldClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]";

export function CommunityTopicForm() {
  const router = useRouter();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.community;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const submission = buildCommunityTopicSubmission({
      title: String(form.get("title") || ""),
      body: String(form.get("body") || ""),
      type: String(form.get("type") || "question"),
      tags: String(form.get("tags") || ""),
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
      if (!response.ok || !path) {
        throw new Error(payload?.error || copy.createError);
      }
      router.push(path);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : copy.createError);
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-busy={busy}
      className="nexus-panel grid gap-4 p-5 shadow-nexus-sm sm:p-6"
    >
      <label className="space-y-1.5">
        <span className="font-label text-secondary">{copy.type}</span>
        <select name="type" className={fieldClass}>
          <option value="question">{copy.question}</option>
          <option value="post">{copy.discussion}</option>
        </select>
      </label>

      <label className="space-y-1.5">
        <span className="font-label text-secondary">{copy.topicTitle}</span>
        <input name="title" minLength={3} maxLength={200} required className={fieldClass} />
      </label>

      <label className="space-y-1.5">
        <span className="font-label text-secondary">{copy.message}</span>
        <textarea
          name="body"
          minLength={10}
          maxLength={20_000}
          rows={10}
          required
          className={fieldClass}
        />
      </label>

      <label className="space-y-1.5">
        <span className="font-label text-secondary">{copy.tags}</span>
        <input name="tags" maxLength={500} className={fieldClass} />
      </label>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <Button type="submit" isLoading={busy}>
        {busy ? copy.publishing : copy.publish}
      </Button>
    </form>
  );
}
