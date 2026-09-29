"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { getBuildFileValidationError } from "../../../../lib/build-file-policy";

export default function NewResourcePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; slug: string } | null>(null);
  const [createdDraft, setCreatedDraft] = useState<{ id: string; slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const fileEntry = form.get("file");
    if (!(fileEntry instanceof File)) {
      setError("Choose a build archive");
      return;
    }
    const fileError = getBuildFileValidationError(fileEntry);
    if (fileError) {
      setError(fileError);
      return;
    }

    setLoading(true);

    try {
      let draft = createdDraft;
      if (!draft) {
        const productResponse = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: String(form.get("title") || ""),
            slug: String(form.get("slug") || ""),
            shortDescription: String(form.get("shortDescription") || ""),
            description: String(form.get("description") || ""),
            type: String(form.get("type") || "script"),
            price: 0,
            currency: "USD",
            licenseModel: "unlimited",
            tags: String(form.get("tags") || "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
            compatibility: {
              mtaMinVersion: String(form.get("mtaMinVersion") || "") || undefined,
              dependencies: String(form.get("dependencies") || "")
                .split(",")
                .map((dependency) => dependency.trim().toLowerCase())
                .filter(Boolean),
            },
          }),
        });
        const productData = await productResponse.json();
        if (!productResponse.ok) {
          throw new Error(productData.error || "Could not create resource");
        }
        draft = {
          id: String(productData.product.id),
          slug: String(productData.product.slug),
        };
        setCreatedDraft(draft);
      }

      const buildForm = new FormData();
      buildForm.set("version", String(form.get("version") || "1.0.0"));
      buildForm.set("releaseNotes", String(form.get("releaseNotes") || ""));
      buildForm.set("mtaVersionTarget", String(form.get("mtaMinVersion") || ""));
      buildForm.set("file", fileEntry);

      const buildResponse = await fetch(
        `/api/products/${draft.id}/builds`,
        { method: "POST", body: buildForm }
      );
      const buildData = await buildResponse.json();
      if (!buildResponse.ok) {
        throw new Error(
          buildData.error || "Resource was created, but the build could not be published"
        );
      }

      setResult(draft);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected publishing error");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-xl mx-auto py-12 nexus-panel p-6 space-y-4">
        <h1 className="text-2xl font-black text-white">Resource submitted for review</h1>
        <p className="text-sm text-neutral-400">
          The build is stored privately. It will become public only after malware scanning and moderator approval.
        </p>
        <Link href={`/workspace/resources/${result.id}`} className="text-sm font-semibold text-accent">
          Manage resource
        </Link>
        <Link href={`/market/${result.slug}`} className="block text-sm font-semibold text-accent">
          Open resource status
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Publish a free resource</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Paid publishing stays disabled until real payments and legal terms are ready.
        </p>
      </div>
      {error && (
        <div role="alert" className="p-4 border border-red-900 bg-red-950/30 text-red-300 text-sm space-y-2">
          <p>{error}</p>
          {createdDraft && (
            <>
              <p>The resource draft is saved. Submitting again will retry its build without creating another resource.</p>
              <Link href={`/workspace/resources/${createdDraft.id}`} className="inline-block font-semibold text-accent">
                Continue from the saved draft
              </Link>
            </>
          )}
        </div>
      )}
      <form onSubmit={submit} aria-busy={loading} className="nexus-panel p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1"><span className="text-xs text-neutral-300">Title</span><input name="title" required minLength={3} className="w-full nexus-inset px-3 py-2" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Slug</span><input name="slug" required pattern="[a-z0-9-]+" className="w-full nexus-inset px-3 py-2" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Short description</span><input name="shortDescription" className="w-full nexus-inset px-3 py-2" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Description</span><textarea name="description" required minLength={10} rows={6} className="w-full nexus-inset px-3 py-2" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Type</span><select name="type" className="w-full nexus-inset px-3 py-2"><option value="script">Script</option><option value="map">Map</option><option value="vehicle">Vehicle</option><option value="model">Model</option><option value="ui">UI</option><option value="plugin">Plugin</option></select></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Tags, comma separated</span><input name="tags" className="w-full nexus-inset px-3 py-2" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Version</span><input name="version" defaultValue="1.0.0" required pattern="v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?" title="Use a version such as 1.0.0 or 1.0.0-beta" className="w-full nexus-inset px-3 py-2" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Minimum MTA version</span><input name="mtaMinVersion" defaultValue="1.6.0" pattern="1\.[0-9]+(\.[0-9]+)?" title="Use an MTA version such as 1.6 or 1.6.0" className="w-full nexus-inset px-3 py-2" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Resource dependencies, comma separated slugs</span><input name="dependencies" placeholder="core-ui, vehicle-pack" className="w-full nexus-inset px-3 py-2" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Build archive</span><input name="file" type="file" accept=".zip,.rar,.7z,.lua" aria-describedby="new-build-file-help" required className="w-full text-sm text-neutral-300" /><span id="new-build-file-help" className="block text-xs text-neutral-500">ZIP, RAR, 7z, or Lua · up to 64 MiB. Clean builds still need moderator approval.</span></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Release notes</span><textarea name="releaseNotes" rows={3} className="w-full nexus-inset px-3 py-2" /></label>
        <button type="submit" disabled={loading} className="sm:col-span-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm">{loading ? "Submitting..." : "Submit free resource for review"}</button>
      </form>
    </div>
  );
}
