"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ContentCommentForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = text.trim();
    if (!normalized || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/content/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: normalized }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not publish the comment");
      }

      setText("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish the comment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-neutral-300">Join the discussion</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          minLength={2}
          maxLength={5000}
          rows={4}
          required
          placeholder="Write a useful, respectful response…"
          className="w-full nexus-inset px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || text.trim().length < 2}
          className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Publishing…" : "Publish comment"}
        </button>
        <span className="text-[11px] text-neutral-500">{text.length}/5000</span>
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
