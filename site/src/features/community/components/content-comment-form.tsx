"use client";

import { Button, ErrorState } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { useNexusLocale } from "../../shell/locale";
import {
  typeBlockSpace15,
  typeFlexWrapCenterGap3,
  typeLabelSecondary,
  typeNumericElevenFaint,
} from "../../shell/type-shell";
import { createCommentIntentKey, submitContentCommentRequest } from "../content-comment-client";
import { getDiscussionCopy } from "../content-discussion-copy";
import { getUserPlatformCopy } from "../user-platform-copy";

export function ContentCommentForm({ slug, actorId }: { slug: string; actorId: string }) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.articles;
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [
      ...Object.values(copy),
      ...Object.values(getDiscussionCopy(locale)),
      ...Object.values(getUserPlatformCopy(locale)),
    ].includes(text)
      ? text
      : fallback;
  }
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingIntent = useRef<{ key: string; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = text.trim();
    if (normalized.length < 2 || submitting) return;

    setSubmitting(true);
    setError(null);
    const frozen =
      pendingIntent.current && pendingIntent.current.text === normalized
        ? pendingIntent.current
        : { key: createCommentIntentKey(), text: normalized };
    pendingIntent.current = frozen;
    try {
      await submitContentCommentRequest({
        slug,
        text: normalized,
        intentKey: frozen.key,
        expectedActorId: actorId,
        locale,
        fallbackError: copy.commentError,
      });

      pendingIntent.current = null;
      setText("");
      router.refresh();
    } catch (caught) {
      setError(safeMessage(caught, copy.commentError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-busy={submitting}>
      <label className={typeBlockSpace15}>
        <span className={typeLabelSecondary}>{copy.joinDiscussion}</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          minLength={2}
          maxLength={5000}
          rows={4}
          required
          placeholder={copy.commentPlaceholder}
          className="w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]"
        />
      </label>
      <div className={typeFlexWrapCenterGap3}>
        <Button
          type="submit"
          size="sm"
          isLoading={submitting}
          disabled={text.trim().length < 2}
          className="min-h-11"
        >
          {submitting ? copy.publishingComment : copy.publishComment}
        </Button>
        <span className={typeNumericElevenFaint}>{text.length}/5000</span>
      </div>
      {error ? <ErrorState title={error} description={copy.commentErrorHint} /> : null}
    </form>
  );
}
