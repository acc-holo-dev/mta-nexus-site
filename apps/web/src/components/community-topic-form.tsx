"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CommunityTopicForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150)}-${Date.now().toString(36)}`;
    try {
      const response = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, slug, body: String(form.get("body") || ""), type: String(form.get("type") || "question"), tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean), status: "published" }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not create topic");
      router.push(`/articles/${payload.content.slug}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create topic");
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="nexus-panel grid gap-4 p-6"><label className="space-y-1"><span className="text-xs text-neutral-300">Type</span><select name="type" className="w-full nexus-inset px-3 py-2 text-sm"><option value="question">Question</option><option value="post">Discussion</option></select></label><label className="space-y-1"><span className="text-xs text-neutral-300">Title</span><input name="title" minLength={3} maxLength={200} required className="w-full nexus-inset px-3 py-2 text-sm" /></label><label className="space-y-1"><span className="text-xs text-neutral-300">Message</span><textarea name="body" minLength={10} maxLength={20000} rows={10} required className="w-full nexus-inset px-3 py-2 text-sm" /></label><label className="space-y-1"><span className="text-xs text-neutral-300">Tags, comma separated</span><input name="tags" className="w-full nexus-inset px-3 py-2 text-sm" /></label>{error && <p role="alert" className="text-xs text-red-400">{error}</p>}<button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Publishing…" : "Publish topic"}</button></form>;
}
