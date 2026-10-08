"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nexus/ui";
import { confirmedCommentId } from "../lib/content-comment-confirmation";
import { useNexusLocale } from "./locale-context";

export function ContentCommentForm({ slug }: { slug: string }) {
  const router = useRouter();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.articles;
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = text.trim();
    if (normalized.length < 2 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/content/${encodeURIComponent(slug)}/comments`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: normalized }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!confirmedCommentId(response.status, payload)) {
        throw new Error(payload?.error || copy.commentError);
      }

      setText("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.commentError,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-busy={submitting}>
      <label className="block space-y-1.5">
        <span className="font-label text-secondary">
          {copy.joinDiscussion}
        </span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          minLength={2}
          maxLength={5000}
          rows={4}
          required
          placeholder={copy.commentPlaceholder}
          className="w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          isLoading={submitting}
          disabled={text.trim().length < 2}
        >
          {submitting ? copy.publishingComment : copy.publishComment}
        </Button>
        <span className="font-numeric text-[11px] text-faint">
          {text.length}/5000
        </span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
