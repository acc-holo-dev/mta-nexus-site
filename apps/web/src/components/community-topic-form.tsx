"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nexus/ui";
import { useNexusLocale } from "./locale-context";

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
    const title = String(form.get("title") || "").trim();
    const base = title
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120);
    const slug = `${base || "topic"}-${Date.now().toString(36)}`;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/content", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          body: String(form.get("body") || "").trim(),
          type: String(form.get("type") || "question"),
          tags: String(form.get("tags") || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => null);
      if (
        !response.ok ||
        payload?.success !== true ||
        typeof payload?.content?.slug !== "string"
      ) {
        throw new Error(payload?.error || copy.createError);
      }
      router.push(
        `/articles/${encodeURIComponent(payload.content.slug)}`,
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.createError,
      );
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
        <input
          name="title"
          minLength={3}
          maxLength={200}
          required
          className={fieldClass}
        />
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
