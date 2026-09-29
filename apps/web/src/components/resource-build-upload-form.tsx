"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getBuildFileValidationError } from "../lib/build-file-policy";

export function ResourceBuildUploadForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const form = new FormData(formElement);
    const file = form.get("file");
    const fileError = getBuildFileValidationError(file instanceof File ? file : null);
    if (fileError) {
      setError(fileError);
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/products/${productId}/builds`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not upload build");

      formElement.reset();
      setMessage("Build submitted for malware review and moderator approval.");
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not upload build");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={submitting} className="nexus-panel p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <h2 className="font-heading text-primary">Submit a build</h2>
        <p className="font-caption text-muted mt-1">
          Every version is immutable and enters pending review. Existing public releases remain available until replaced or retired.
        </p>
      </div>
      <label className="space-y-1">
        <span className="font-label text-muted uppercase">Version</span>
        <input name="version" required placeholder="1.0.1" pattern="v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?" className="w-full nexus-inset px-3 py-2" />
      </label>
      <label className="space-y-1">
        <span className="font-label text-muted uppercase">MTA target</span>
        <input name="mtaVersionTarget" placeholder="1.6.0" pattern="1\.[0-9]+(\.[0-9]+)?" className="w-full nexus-inset px-3 py-2" />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="font-label text-muted uppercase">Archive</span>
        <input name="file" type="file" accept=".zip,.rar,.7z,.lua" aria-describedby="build-file-help" required className="w-full text-sm text-secondary" />
        <span id="build-file-help" className="block font-caption text-muted">
          ZIP, RAR, 7z, or Lua · up to 64 MiB. Clean builds still need moderator approval.
        </span>
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="font-label text-muted uppercase">Release notes</span>
        <textarea name="releaseNotes" rows={4} maxLength={5000} className="w-full nexus-inset px-3 py-2" />
      </label>
      {error && <p role="alert" className="sm:col-span-2 font-caption text-danger">{error}</p>}
      {message && <p role="status" aria-live="polite" className="sm:col-span-2 font-caption text-success">{message}</p>}
      <button type="submit" disabled={submitting} className="sm:col-span-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {submitting ? "Uploading…" : "Submit build for review"}
      </button>
    </form>
  );
}
