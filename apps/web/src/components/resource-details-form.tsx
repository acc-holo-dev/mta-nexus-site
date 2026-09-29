"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

interface ResourceDetailsFormProps {
  product: {
    id: string;
    title: string;
    slug: string;
    shortDescription?: string;
    description: string;
    type: string;
    tags: string[];
    compatibility: { mtaMinVersion?: string; dependencies?: string[] };
  };
}

export function ResourceDetailsForm({ product }: ResourceDetailsFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") || ""),
          slug: String(form.get("slug") || ""),
          shortDescription: String(form.get("shortDescription") || "") || undefined,
          description: String(form.get("description") || ""),
          type: String(form.get("type") || "script"),
          tags: String(form.get("tags") || "").split(",").map((value) => value.trim()).filter(Boolean),
          compatibility: {
            mtaMinVersion: String(form.get("mtaMinVersion") || "") || undefined,
            dependencies: String(form.get("dependencies") || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
          },
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not update resource");
      setSaved(true);
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not update resource");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="nexus-panel p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <h2 className="font-heading text-primary">Resource details</h2>
        <p className="font-caption text-muted mt-1">Editing metadata never bypasses build moderation.</p>
      </div>
      <label className="space-y-1"><span className="font-label text-muted uppercase">Title</span><input name="title" required minLength={3} maxLength={120} defaultValue={product.title} className="w-full nexus-inset px-3 py-2" /></label>
      <label className="space-y-1"><span className="font-label text-muted uppercase">Slug</span><input name="slug" required pattern="[a-z0-9-]+" defaultValue={product.slug} className="w-full nexus-inset px-3 py-2" /></label>
      <label className="space-y-1 sm:col-span-2"><span className="font-label text-muted uppercase">Short description</span><input name="shortDescription" maxLength={250} defaultValue={product.shortDescription || ""} className="w-full nexus-inset px-3 py-2" /></label>
      <label className="space-y-1 sm:col-span-2"><span className="font-label text-muted uppercase">Description</span><textarea name="description" required minLength={10} maxLength={10000} rows={5} defaultValue={product.description} className="w-full nexus-inset px-3 py-2" /></label>
      <label className="space-y-1"><span className="font-label text-muted uppercase">Type</span><select name="type" defaultValue={product.type} className="w-full nexus-inset px-3 py-2"><option value="script">Script</option><option value="model">Model</option><option value="vehicle">Vehicle</option><option value="map">Map</option><option value="ui">UI</option><option value="plugin">Plugin</option><option value="api">API</option><option value="service">Service</option><option value="bundle">Bundle</option></select></label>
      <label className="space-y-1"><span className="font-label text-muted uppercase">Minimum MTA</span><input name="mtaMinVersion" defaultValue={product.compatibility.mtaMinVersion || ""} placeholder="1.6.0" className="w-full nexus-inset px-3 py-2" /></label>
      <label className="space-y-1 sm:col-span-2"><span className="font-label text-muted uppercase">Tags</span><input name="tags" defaultValue={product.tags.join(", ")} className="w-full nexus-inset px-3 py-2" /></label>
      <label className="space-y-1 sm:col-span-2"><span className="font-label text-muted uppercase">Dependencies</span><input name="dependencies" defaultValue={(product.compatibility.dependencies || []).join(", ")} className="w-full nexus-inset px-3 py-2" /></label>
      {error && <p className="sm:col-span-2 font-caption text-danger">{error}</p>}
      {saved && <p className="sm:col-span-2 font-caption text-success">Resource details saved.</p>}
      <button disabled={submitting} className="sm:col-span-2 rounded-md border border-base bg-elevated px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">{submitting ? "Saving…" : "Save details"}</button>
    </form>
  );
}
